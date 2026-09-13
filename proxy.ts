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
  //
  // The trailing image-extension exclusion covers everything in public/
  // (e.g. yfd-logo-icon.png, used on the unauthenticated /login page itself
  // via AuthShell) -- auth.config.ts's PUBLIC_PATHS only ever listed page
  // routes, never static assets, so a logged-out request for the logo image
  // failed the authorized() check and got redirected back to /login's HTML
  // -- the login page's own logo request bouncing back to the login page,
  // which is why the logo never rendered there. favicon.ico already had its
  // own explicit exclusion below; this generalizes that to every image
  // extension so the next public/ asset doesn't hit the same bug.
  matcher: [
    "/((?!api/auth|api/email/inbound|api/reports|_next/static|_next/image|favicon.ico|privacy-policy|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
