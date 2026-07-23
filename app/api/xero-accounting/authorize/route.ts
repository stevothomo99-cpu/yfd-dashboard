import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";

// Least-privilege scopes for revenue-by-client reporting: read-only
// Invoices + Contacts, nothing else. offline_access is required to get a
// refresh token back at all. Separate consent from the XPM/Practice
// Manager connection -- this connects to YFD's own Xero Accounting
// organisation, not the Practice Manager tenant.
const XERO_ACCOUNTING_SCOPES = [
  "offline_access",
  "accounting.transactions.read",
  "accounting.contacts.read",
].join(" ");

// Starts the one-time Xero Accounting OAuth consent flow. Redirects
// straight to Xero's authorize screen using XERO_ACCOUNTING_CLIENT_ID from
// env -- never exposed to the browser, chat, or logs. redirect_uri is
// built from the current request's origin so it matches whichever
// domain's Redirect URI is registered in the Xero app.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const clientId = process.env.XERO_ACCOUNTING_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "XERO_ACCOUNTING_CLIENT_ID is not set" }, { status: 500 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/xero-accounting/callback`;
  const authorizeUrl = new URL("https://login.xero.com/identity/connect/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", XERO_ACCOUNTING_SCOPES);
  authorizeUrl.searchParams.set("state", crypto.randomUUID());

  return NextResponse.redirect(authorizeUrl.toString());
}
