import { NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  exchangeXeroAccountingAuthorizationCode,
  fetchXeroAccountingConnections,
  storeInitialXeroAccountingTokens,
} from "@/lib/xeroAccounting";

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

// One-time OAuth consent callback for the Xero Accounting connection --
// mirrors app/api/xpm/callback/route.ts exactly, but produces
// XERO_ACCOUNTING_* env vars for YFD's own Xero Accounting organisation
// (revenue/invoices), a separate connection from XPM/Practice Manager.
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

  const redirectUri = `${request.nextUrl.origin}/api/xero-accounting/callback`;

  try {
    const tokens = await exchangeXeroAccountingAuthorizationCode(code, redirectUri);
    const connections = await fetchXeroAccountingConnections(tokens.access_token);

    await storeInitialXeroAccountingTokens(tokens);

    const tenantRows = connections.length
      ? connections.map((c) => `<li><code>${c.tenantId}</code> — ${c.tenantName}</li>`).join("")
      : "<li>No connections returned -- did you select an organisation during consent?</li>";

    return htmlPage(
      "Xero Accounting connected",
      `
      <h1>Connected to Xero Accounting</h1>
      <p class="ok">Tokens exchanged and cached. Revenue reporting will start working as soon as <code>XERO_ACCOUNTING_TENANT_ID</code> is set below and the app redeploys.</p>

      <h3>1. Set XERO_ACCOUNTING_TENANT_ID in Vercel</h3>
      <p>${connections.length === 1 ? "Use this tenant ID -- make sure it's YFD's own accounting organisation, not a client's:" : "Pick YFD's own accounting organisation's tenant ID (not a client's file):"}</p>
      <ul>${tenantRows}</ul>

      <h3>2. XERO_ACCOUNTING_REFRESH_TOKEN (cold-start fallback only)</h3>
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
