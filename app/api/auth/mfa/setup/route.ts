import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setPendingMfaSecret } from "@/lib/supabase";
import { generateMfaSecret, generateMfaKeyUri } from "@/lib/mfa";

// Begins MFA enrollment for the current session's own user. Self-only —
// never accepts a target user id from the client, to prevent one user
// enrolling MFA on someone else's account.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const secret = generateMfaSecret();
    await setPendingMfaSecret(session.user.id, secret);

    return NextResponse.json({
      secret,
      otpauthUrl: generateMfaKeyUri(secret, session.user.email),
    });
  } catch (err) {
    console.error("[mfa/setup] failed to start MFA enrollment:", err);
    return NextResponse.json({ error: "Failed to start MFA enrollment" }, { status: 500 });
  }
}
