import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { getMfaSecret, enableMfa } from "@/lib/supabase";
import { verifyMfaCode } from "@/lib/mfa";

interface VerifyRequest {
  code: string;
}

// Confirms MFA enrollment for the current session's own user by checking a
// submitted code against the pending secret, then enables MFA. Self-only —
// never accepts a target user id from the client.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { code } = (await request.json()) as VerifyRequest;
    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const secret = await getMfaSecret(session.user.id);
    if (!secret) {
      return NextResponse.json({ error: "No pending MFA enrollment found" }, { status: 400 });
    }

    if (!verifyMfaCode(secret, code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    await enableMfa(session.user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[mfa/verify] failed to verify MFA enrollment code:", err);
    return NextResponse.json({ error: "Failed to verify code" }, { status: 500 });
  }
}
