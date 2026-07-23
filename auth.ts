import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { verifyDashboardUserPassword, getMfaSecret } from "./lib/supabase";
import { verifyMfaCode } from "./lib/mfa";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "Two-factor code", type: "text" },
      },
      async authorize(creds) {
        const submittedUser = typeof creds?.username === "string" ? creds.username : "";
        const submittedPass = typeof creds?.password === "string" ? creds.password : "";
        const submittedTotpCode = typeof creds?.totpCode === "string" ? creds.totpCode : "";

        if (!submittedUser || !submittedPass) return null;

        // Any user provisioned via /settings/users, backed by Supabase Auth
        // + the dashboard_users table.
        const dashboardUser = await verifyDashboardUserPassword(submittedUser, submittedPass);
        if (!dashboardUser) return null;

        if (dashboardUser.mfa_enabled) {
          // Fail closed: the login page's two-step flow is responsible for
          // knowing to ask for a code before ever calling signIn() with
          // credentials for an MFA-enabled account, so getting here without
          // a code means a step was skipped and this must not silently
          // succeed.
          if (!submittedTotpCode) return null;

          const secret = await getMfaSecret(dashboardUser.id);
          if (!secret) return null;

          if (!verifyMfaCode(secret, submittedTotpCode)) return null;
        }

        return {
          id: dashboardUser.id,
          name: dashboardUser.username,
          email: dashboardUser.email,
          role: dashboardUser.role,
          mustChangePassword: dashboardUser.must_change_password,
        };
      },
    }),
  ],
});
