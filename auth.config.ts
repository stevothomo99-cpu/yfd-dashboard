import type { NextAuthConfig } from "next-auth";

// Paths reachable without a session at all (the credentials login flow and
// the forgot/reset-password flow, which by definition can't require being
// already logged in).
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      const isOnPublicPath = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));

      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      if (isOnPublicPath) return true;
      if (!isLoggedIn) return false;

      // Admin-provisioned users start with a password the admin picked --
      // force them to set their own before touching anything else. The
      // change-password page/API itself must stay reachable while the flag
      // is still true, or this would redirect-loop.
      const isOnChangePassword = nextUrl.pathname.startsWith("/change-password");
      const isChangePasswordApi = nextUrl.pathname.startsWith("/api/account/change-password");
      if (auth.user.mustChangePassword && !isOnChangePassword && !isChangePasswordApi) {
        return Response.redirect(new URL("/change-password", nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
