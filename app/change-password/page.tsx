import { auth } from "@/auth";
import AuthShell from "@/components/auth/AuthShell";
import ChangePasswordFormClient from "./ChangePasswordFormClient";

export default async function ChangePasswordPage() {
  const session = await auth();
  const forced = session?.user?.mustChangePassword ?? false;

  return (
    <AuthShell subtitle={forced ? "Set your own password to continue" : "Change your password"}>
      <ChangePasswordFormClient forced={forced} />
    </AuthShell>
  );
}
