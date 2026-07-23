import { NextResponse, NextRequest } from "next/server";
import { getSupabaseAdmin, setMustChangePassword } from "@/lib/supabase";

// Called by /reset-password right after the browser-side Supabase client
// has already updated the user's password using their recovery session --
// this just clears must_change_password on our own dashboard_users row too,
// in case the account was still flagged for a forced first-login change.
// The access token proves the caller really is that account (verified via
// Supabase Auth itself, not trusted blindly).
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { accessToken?: string };
  if (!body.accessToken) {
    return NextResponse.json({ error: "accessToken is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(body.accessToken);
  if (error || !data.user) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  await setMustChangePassword(data.user.id, false);
  return NextResponse.json({ success: true });
}
