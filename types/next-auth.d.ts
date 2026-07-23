import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: "admin" | "user";
    mustChangePassword?: boolean;
  }

  interface Session {
    user: {
      role?: "admin" | "user";
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: "admin" | "user";
    mustChangePassword?: boolean;
  }
}
