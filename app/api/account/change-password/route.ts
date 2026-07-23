import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { updateDashboardUserPassword, setMustChangePassword } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

// Sets the signed-in user's own password -- covers both the forced
// first-login change (must_change_password) and a voluntary change from
// /change-password at any other time. Session-authenticated only; the
// caller doesn't need to know their old password since they're already
// proven to be signed in as this account.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as { newPassword?: string };
  const newPassword = body.newPassword ?? "";
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const ok = await updateDashboardUserPassword(session.user.id, newPassword);
  if (!ok) {
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }

  await setMustChangePassword(session.user.id, false);
  return NextResponse.json({ success: true });
}
