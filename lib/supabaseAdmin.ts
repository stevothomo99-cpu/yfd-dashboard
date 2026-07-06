import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Pinned to globalThis for the same reason as lib/cache.ts's Redis client —
// survives Turbopack/webpack re-instantiating this module across bundles.
const globalForSupabase = globalThis as unknown as {
  __yfdSupabaseAdmin?: SupabaseClient;
};

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.");
    this.name = "SupabaseNotConfiguredError";
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Server-only client using the service_role key — bypasses RLS. Every
// workflow table has RLS enabled with no policies, so this is the only
// client that can read/write them; never expose this key to the browser.
export function supabaseAdmin(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError();
  if (!globalForSupabase.__yfdSupabaseAdmin) {
    globalForSupabase.__yfdSupabaseAdmin = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } },
    );
  }
  return globalForSupabase.__yfdSupabaseAdmin;
}
