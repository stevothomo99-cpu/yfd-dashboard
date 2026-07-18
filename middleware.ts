export { auth as middleware } from "@/auth";

// Protects every route except the NextAuth handler itself, the login page,
// static assets, and the favicon. Unauthenticated requests are redirected
// to /login by the `authorized` callback in auth.config.ts — this applies
// to API routes as well as pages, since neither had any access control
// before this middleware existed.
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)"],
};
