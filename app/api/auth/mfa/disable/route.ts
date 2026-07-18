import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { disableMfa } from "@/lib/supabase";

// Disables MFA for the current session's own user. Self-only — never
// accepts a target user id from the client.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await disableMfa(session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[mfa/disable] failed to disable MFA:", err);
    return NextResponse.json({ error: "Failed to disable MFA" }, { status: 500 });
  }
}
