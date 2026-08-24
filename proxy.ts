import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // api/reports/* are Vercel Cron's own server-to-server GETs (see
  // vercel.json) -- no browser, no session cookie, ever. Each route
  // authenticates itself via its own CRON_SECRET Bearer-token check
  // (authorize() in each route.ts), so it must never hit this
  // session-based middleware at all -- without this exclusion, every cron
  // fire was silently redirected to /login (307) before the route handler
  // ever ran, so none of the five scheduled report emails were actually
  // sent despite CRON_SECRET/Resend being correctly configured.
  matcher: [
    "/((?!api/auth|api/email/inbound|api/reports|_next/static|_next/image|favicon.ico|privacy-policy).*)",
  ],
};
