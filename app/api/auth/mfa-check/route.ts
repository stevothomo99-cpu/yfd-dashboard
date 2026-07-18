import { NextResponse, NextRequest } from "next/server";
import { verifyDashboardUserPassword } from "@/lib/supabase";

interface MfaCheckRequest {
  username: string;
  password: string;
}

// Lets the login page find out, before ever calling signIn(), whether a
// given username/password pair belongs to an MFA-enabled account — without
// establishing a session. Performs a real password check, so nothing here
// should ever log the raw request body/password.
export async function POST(request: NextRequest) {
  try {
    const { username, password } = (await request.json()) as MfaCheckRequest;

    if (!username || !password) {
      return NextResponse.json({ valid: false });
    }

    const dashboardUser = await verifyDashboardUserPassword(username, password);

    if (!dashboardUser) {
      // Generic failure — don't distinguish wrong-username from
      // wrong-password, and don't leak mfaRequired for invalid creds.
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true, mfaRequired: dashboardUser.mfa_enabled });
  } catch (err) {
    console.error("[mfa-check] error checking credentials:", err);
    return NextResponse.json({ valid: false });
  }
}
