import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { verifyDashboardUserPassword } from "./lib/supabase";

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

        // Any user provisioned via /settings/users, backed by Supabase Auth
        // + the dashboard_users table.
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
