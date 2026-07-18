import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

// Returns the current session's own mfa_enabled status. Self-only — always
// derives the target user from the session, never from the request.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("dashboard_users")
    .select("mfa_enabled")
    .eq("id", session.user.id)
    .maybeSingle<{ mfa_enabled: boolean }>();

  if (error || !data) {
    console.error("[mfa/status] failed to load mfa_enabled:", error);
    return NextResponse.json({ error: "Failed to load MFA status" }, { status: 500 });
  }

  return NextResponse.json({ mfaEnabled: data.mfa_enabled });
}
