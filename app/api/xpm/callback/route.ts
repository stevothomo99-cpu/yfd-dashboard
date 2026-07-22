import { NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  exchangeXeroAuthorizationCode,
  fetchXeroConnections,
  storeInitialXeroTokens,
} from "@/lib/xpm";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlPage(title: string, bodyHtml: string): Response {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; color: #111; }
  h1 { font-size: 18px; }
  code, pre { background: #f5f4f0; border: 1px solid #e1e0d9; border-radius: 8px; padding: 10px 12px; display: block; overflow-wrap: anywhere; font-size: 13px; }
  .warn { color: #633806; background: #FAEEDA; border: 1px solid #f0d9a8; border-radius: 8px; padding: 10px 12px; margin: 12px 0; }
  .err { color: #501313; background: #FCEBEB; border: 1px solid #f0b8b8; border-radius: 8px; padding: 10px 12px; }
  .ok { color: #0d4a2f; background: #e3f6ec; border: 1px solid #b8e6cd; border-radius: 8px; padding: 10px 12px; }
</style>
</head><body>${bodyHtml}</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// One-time OAuth consent callback -- Xero redirects the browser here after
// the user approves access, with ?code=... to exchange for tokens. This is
// the only place in the app that performs the authorization_code grant;
// everywhere else (lib/xpm.ts) assumes a refresh token already exists.
//
// The redirect_uri Xero validates against must exactly match what's
// registered on the Xero app AND what was used in the initial /authorize
// URL -- built from the incoming request's own origin so it works
// identically whichever domain (preview or production) is registered.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return htmlPage("Not authorized", `<h1>Not authorized</h1><p class="err">Sign in as an admin first, then retry this link.</p>`);
  }

  const params = request.nextUrl.searchParams;
  const error = params.get("error");
  if (error) {
    const description = params.get("error_description");
    return htmlPage(
      "Xero declined",
      `<h1>Xero declined the request</h1><p class="err">${escapeHtml(error)}${description ? `: ${escapeHtml(description)}` : ""}</p>`,
    );
  }

  const code = params.get("code");
  if (!code) {
    return htmlPage("Missing code", `<h1>Missing authorization code</h1><p class="err">No ?code= param -- this route should only ever be hit by Xero's redirect after consent.</p>`);
  }

  const redirectUri = `${request.nextUrl.origin}/api/xpm/callback`;

  try {
    const tokens = await exchangeXeroAuthorizationCode(code, redirectUri);
    const connections = await fetchXeroConnections(tokens.access_token);

    // Cache immediately so the app can start working the moment
    // XPM_TENANT_ID is set -- no redeploy needed for the token itself.
    await storeInitialXeroTokens(tokens);

    const tenantRows = connections.length
      ? connections.map((c) => `<li><code>${c.tenantId}</code> — ${c.tenantName}</li>`).join("")
      : "<li>No connections returned -- did you select an organisation during consent?</li>";

    return htmlPage(
      "Xero connected",
      `
      <h1>Connected to Xero</h1>
      <p class="ok">Tokens exchanged and cached. XPM will start working as soon as <code>XPM_TENANT_ID</code> is set below and the app redeploys.</p>

      <h3>1. Set XPM_TENANT_ID in Vercel</h3>
      <p>${connections.length === 1 ? "Use this tenant ID:" : "Pick the right organisation's tenant ID:"}</p>
      <ul>${tenantRows}</ul>

      <h3>2. XPM_REFRESH_TOKEN (cold-start fallback only)</h3>
      <p>Already cached and working -- you don't need this for things to function right now. But set it as a fallback in case the cache is ever cleared:</p>
      <pre>${tokens.refresh_token}</pre>

      <div class="warn">This refresh token is shown once and not logged anywhere else. Copy it now if you want the env var fallback.</div>
      `,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return htmlPage("Exchange failed", `<h1>Token exchange failed</h1><p class="err">${message}</p>`);
  }
}
