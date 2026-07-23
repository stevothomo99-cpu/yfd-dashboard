import { NextResponse, NextRequest } from "next/server";
import { getSupabaseClient, getDashboardUserByEmail } from "@/lib/supabase";

// Public (unauthenticated) endpoint -- triggers Supabase Auth's own
// recovery email, since real passwords live in Supabase Auth (see
// lib/supabase.ts's verifyDashboardUserPassword), not a column we control
// directly. Always returns the same generic response whether or not the
// email matches an account, so this can't be used to enumerate accounts.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  const genericResponse = NextResponse.json({
    message: "If that email is registered, a password reset link has been sent.",
  });

  if (!email) return genericResponse;

  try {
    const user = await getDashboardUserByEmail(email);
    if (!user) return genericResponse;

    const redirectTo = `${request.nextUrl.origin}/reset-password`;
    const client = getSupabaseClient();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      console.error("[auth/forgot-password] resetPasswordForEmail failed:", error.message);
    }
  } catch (err) {
    console.error("[auth/forgot-password] error:", err);
  }

  return genericResponse;
}
