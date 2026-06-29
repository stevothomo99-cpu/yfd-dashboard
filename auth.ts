import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import crypto from "node:crypto";
import { authConfig } from "./auth.config";

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
        const expectedUser = process.env.AUTH_USERNAME;
        const expectedPass = process.env.AUTH_PASSWORD;
        if (!expectedUser || !expectedPass) return null;

        const submittedUser = typeof creds?.username === "string" ? creds.username : "";
        const submittedPass = typeof creds?.password === "string" ? creds.password : "";

        if (
          !constantTimeEqual(submittedUser, expectedUser) ||
          !constantTimeEqual(submittedPass, expectedPass)
        ) {
          return null;
        }

        return {
          id: "ceo",
          name: expectedUser,
        };
      },
    }),
  ],
});
