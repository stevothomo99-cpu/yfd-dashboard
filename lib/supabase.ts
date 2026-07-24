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
  must_change_password: boolean;
  suspended: boolean;
}

const DASHBOARD_USER_COLUMNS =
  "id, email, username, role, created_at, mfa_enabled, must_change_password, suspended";

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
      .select(DASHBOARD_USER_COLUMNS)
      .eq("username", usernameOrEmail)
      .maybeSingle<DashboardUser>();

    if (!dashboardUser) {
      const byEmail = await admin
        .from("dashboard_users")
        .select(DASHBOARD_USER_COLUMNS)
        .eq("email", usernameOrEmail)
        .maybeSingle<DashboardUser>();
      dashboardUser = byEmail.data;
    }

    if (!dashboardUser) return null;

    // Fail closed the same way a wrong password would -- don't disclose
    // that the account exists but is paused, just refuse the login like any
    // other invalid attempt (login page's error copy is generic either way).
    if (dashboardUser.suspended) return null;

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

// Looks up a dashboard_users row by email only -- feeds the forgot-password
// flow, which needs to know if an email belongs to a real account before
// deciding whether to trigger Supabase's recovery email (see
// app/api/auth/forgot-password/route.ts). Callers must not use this to leak
// account existence back to the caller of that endpoint.
export async function getDashboardUserByEmail(email: string): Promise<DashboardUser | null> {
  if (!isSupabaseConfigured()) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("dashboard_users")
    .select(DASHBOARD_USER_COLUMNS)
    .eq("email", email)
    .maybeSingle<DashboardUser>();
  return data ?? null;
}

// Sets a user's real Supabase Auth password directly (used by both the
// forced/voluntary in-app change-password flow, which already has an
// authenticated session, and isn't needed by the forgot-password flow --
// that one lets Supabase's own recovery session update the password
// client-side instead). Also used right after account creation is NOT
// needed here since /api/admin/users sets the initial password itself via
// auth.admin.createUser.
export async function updateDashboardUserPassword(userId: string, newPassword: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) {
    console.error("[updateDashboardUserPassword]", error.message);
    return false;
  }
  return true;
}

export async function setMustChangePassword(userId: string, value: boolean): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("dashboard_users").update({ must_change_password: value }).eq("id", userId);
  if (error) {
    console.error("[setMustChangePassword]", error.message);
  }
}

// Pauses/resumes a user's access without deleting anything -- reversible.
// verifyDashboardUserPassword refuses login for a suspended account before
// it ever touches Supabase Auth, so this alone is enough to lock someone
// out immediately regardless of session state (NextAuth JWTs aren't
// re-checked against this on every request, but the next login attempt --
// or the next time their token needs a fresh sign-in -- is blocked).
export async function setUserSuspended(userId: string, suspended: boolean): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("dashboard_users").update({ suspended }).eq("id", userId);
  if (error) {
    console.error("[setUserSuspended]", error.message);
    return false;
  }
  return true;
}

// Fully removes a user -- both the dashboard_users profile and the
// underlying Supabase Auth account (so the email is completely free to
// re-register later, unlike suspending). Destructive and irreversible; the
// caller (API route) is responsible for confirming this is really wanted.
export async function deleteDashboardUser(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();

  const { error: profileError } = await admin.from("dashboard_users").delete().eq("id", userId);
  if (profileError) {
    console.error("[deleteDashboardUser] profile delete failed:", profileError.message);
    return false;
  }

  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    console.error("[deleteDashboardUser] auth delete failed:", authError.message);
    return false;
  }

  return true;
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
