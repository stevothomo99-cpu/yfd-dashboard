import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
      .select("id, email, username, role, created_at")
      .eq("username", usernameOrEmail)
      .maybeSingle<DashboardUser>();

    if (!dashboardUser) {
      const byEmail = await admin
        .from("dashboard_users")
        .select("id, email, username, role, created_at")
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
