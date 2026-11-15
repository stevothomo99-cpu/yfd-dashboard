import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { disableMfa, verifyDashboardUserPassword } from "@/lib/supabase";

interface DisableRequest {
  password?: string;
}

// Disables MFA for the current session's own user. Self-only — never
// accepts a target user id from the client. Requires the account's current
// password as step-up re-auth: a long-lived session cookie (JWT sessions
// last up to 30 days) was previously enough on its own to turn MFA off, so
// a hijacked session could strip this protection with nothing more than
// that cookie.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { password } = (await request.json()) as DisableRequest;
    if (!password) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }

    const verified = await verifyDashboardUserPassword(session.user.email, password);
    if (!verified || verified.id !== session.user.id) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
    }

    await disableMfa(session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[mfa/disable] failed to disable MFA:", err);
    return NextResponse.json({ error: "Failed to disable MFA" }, { status: 500 });
  }
}
