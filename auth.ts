import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import crypto from "node:crypto";
import { authConfig } from "./auth.config";
import { verifyDashboardUserPassword } from "./lib/supabase";

function constantTimeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const submittedUser = typeof creds?.username === "string" ? creds.username : "";
        const submittedPass = typeof creds?.password === "string" ? creds.password : "";

        if (!submittedUser || !submittedPass) return null;

        // Path 1: single hardcoded CEO account via env vars (original setup).
        const expectedUser = process.env.AUTH_USERNAME;
        const expectedPass = process.env.AUTH_PASSWORD;
        if (
          expectedUser &&
          expectedPass &&
          constantTimeEqual(submittedUser, expectedUser) &&
          constantTimeEqual(submittedPass, expectedPass)
        ) {
          return { id: "ceo", name: expectedUser, role: "admin" };
        }

        // Path 2: any user provisioned via /settings/users, backed by
        // Supabase Auth + the dashboard_users table.
        const dashboardUser = await verifyDashboardUserPassword(submittedUser, submittedPass);
        if (dashboardUser) {
          return {
            id: dashboardUser.id,
            name: dashboardUser.username,
            email: dashboardUser.email,
            role: dashboardUser.role,
          };
        }

        return null;
      },
    }),
  ],
});
