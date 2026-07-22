import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";

// Only the practicemanager scopes the app actually calls (lib/xpm.ts hits
// job.api/staff.api/time.api/invoice.api, nothing else) -- least privilege,
// even though the Xero app is also configured for files/assets/projects.
// offline_access is required to get a refresh token back at all.
const XERO_SCOPES = [
  "offline_access",
  "practicemanager",
  "practicemanager.client",
  "practicemanager.client.read",
  "practicemanager.job",
  "practicemanager.job.read",
  "practicemanager.read",
  "practicemanager.staff",
  "practicemanager.staff.read",
  "practicemanager.time",
  "practicemanager.time.read",
].join(" ");

// Starts the one-time XPM OAuth consent flow. Redirects straight to Xero's
// authorize screen using XPM_CLIENT_ID from env -- never exposed to the
// browser, chat, or logs. redirect_uri is built from the current request's
// origin so it matches whichever domain's Redirect URI is registered in
// the Xero app (production or a preview domain, whichever this is hit on).
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const clientId = process.env.XPM_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "XPM_CLIENT_ID is not set" }, { status: 500 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/xpm/callback`;
  const authorizeUrl = new URL("https://login.xero.com/identity/connect/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", XERO_SCOPES);
  authorizeUrl.searchParams.set("state", crypto.randomUUID());

  return NextResponse.redirect(authorizeUrl.toString());
}
