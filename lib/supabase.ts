import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret, decryptSecret } from "./crypto";

let client: SupabaseClient | null = null;
let admin: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required"
    );
  }

  client = createClient(url, anonKey, { auth: { persistSession: false } });
  return client;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    );
  }

  admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  return admin;
}

export interface DashboardUser {
  id: string;
  email: string;
  username: string;
  role: "admin" | "user";
  created_at: string;
  mfa_enabled: boolean;
}

/**
 * Looks up a dashboard_users row by username or email, then verifies the
 * password against Supabase Auth. Returns null on any failure (unknown
 * user, wrong password, or Supabase not configured) rather than throwing —
 * callers use this from NextAuth's authorize(), which must never throw.
 */
export async function verifyDashboardUserPassword(
  usernameOrEmail: string,
  password: string
): Promise<DashboardUser | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const admin = getSupabaseAdmin();

    let { data: dashboardUser } = await admin
      .from("dashboard_users")
      .select("id, email, username, role, created_at, mfa_enabled")
      .eq("username", usernameOrEmail)
      .maybeSingle<DashboardUser>();

    if (!dashboardUser) {
      const byEmail = await admin
        .from("dashboard_users")
        .select("id, email, username, role, created_at, mfa_enabled")
        .eq("email", usernameOrEmail)
        .maybeSingle<DashboardUser>();
      dashboardUser = byEmail.data;
    }

    if (!dashboardUser) return null;

    const authClient = getSupabaseClient();
    const { data, error } = await authClient.auth.signInWithPassword({
      email: dashboardUser.email,
      password,
    });

    if (error || !data.user) return null;

    return dashboardUser;
  } catch (err) {
    console.error("[verifyDashboardUserPassword]", err);
    return null;
  }
}

// Fetches and decrypts the stored TOTP secret for a user, if any. Returns
// null if no secret is stored, or if decryption fails (same fail-safe
// pattern as lib/xpm.ts's tryDecrypt — treat a bad ciphertext as absent
// rather than throwing out of a caller that must not throw).
export async function getMfaSecret(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();

  const { data } = await admin
    .from("dashboard_users")
    .select("mfa_secret")
    .eq("id", userId)
    .maybeSingle<{ mfa_secret: string | null }>();

  if (!data?.mfa_secret) return null;

  try {
    return decryptSecret(data.mfa_secret);
  } catch (err) {
    console.error("[getMfaSecret] Failed to decrypt stored MFA secret, treating as absent:", err);
    return null;
  }
}

// Encrypts and stores a newly-generated TOTP secret for a user, ahead of
// enrollment confirmation. Does not enable MFA — that only happens once the
// user proves they can generate a valid code (see enableMfa below).
export async function setPendingMfaSecret(userId: string, secret: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const encrypted = encryptSecret(secret);

  await admin
    .from("dashboard_users")
    .update({ mfa_secret: encrypted })
    .eq("id", userId);
}

// Marks MFA as enabled for a user, after a successful enrollment code check.
export async function enableMfa(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();

  await admin
    .from("dashboard_users")
    .update({ mfa_enabled: true })
    .eq("id", userId);
}

// Disables MFA and clears the stored secret so no stale secret is left
// behind for a future re-enrollment.
export async function disableMfa(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();

  await admin
    .from("dashboard_users")
    .update({ mfa_enabled: false, mfa_secret: null })
    .eq("id", userId);
}
