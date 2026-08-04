import { cache } from "react";
import { cacheGet, cacheSet } from "./cache";
import { getSupabaseAdmin } from "./supabase";

// Postgres (app_settings, migration 015) is the source of truth; Redis sits in
// front purely as a cache.
//
// It used to be Redis alone, with no TTL and nothing behind it. That holds
// until the cache doesn't: an eviction, a flush or swapping the Upstash
// instance silently blanked partnerName, and since that value scopes which
// clients, jobs and staff the whole app can see, losing it empties the
// practice -- presenting as "Set a Partner name in Settings", which is
// indistinguishable from a genuine first run.

const KEY = "settings";
const TTL_SECONDS = 5 * 60;
const ROW_ID = 1;

export interface DashboardSettings {
  partnerName: string;
  excludedStaffIds: string[];
}

const DEFAULTS: DashboardSettings = {
  partnerName: "",
  excludedStaffIds: [],
};

interface AppSettingsRow {
  partner_name: string | null;
  excluded_staff_ids: string[] | null;
}

function fromRow(row: AppSettingsRow | null): DashboardSettings {
  return {
    partnerName: row?.partner_name ?? DEFAULTS.partnerName,
    excludedStaffIds: row?.excluded_staff_ids ?? DEFAULTS.excludedStaffIds,
  };
}

async function readFromDatabase(): Promise<DashboardSettings> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("app_settings")
    .select("partner_name, excluded_staff_ids")
    .eq("id", ROW_ID)
    .maybeSingle<AppSettingsRow>();

  if (error) {
    // Deliberately not swallowed into defaults: returning an empty Partner
    // here would look exactly like "not configured yet" and quietly empty
    // every page, which is the failure mode this table exists to remove.
    throw new Error(`Failed to read app_settings: ${error.message}`);
  }
  return fromRow(data);
}

// Memoized per-request (React cache()): several pages read settings from more
// than one place in a single render. Not a cross-request cache -- a PATCH is
// visible on the very next request.
export const getSettings = cache(async function getSettings(): Promise<DashboardSettings> {
  const cached = await cacheGet<DashboardSettings>(KEY);
  if (cached) {
    return {
      partnerName: cached.partnerName ?? DEFAULTS.partnerName,
      excludedStaffIds: cached.excludedStaffIds ?? DEFAULTS.excludedStaffIds,
    };
  }

  const settings = await readFromDatabase();
  // Warm the cache but don't fail the read if Redis is unavailable -- the
  // database already answered.
  try {
    await cacheSet(KEY, settings, TTL_SECONDS);
  } catch (err) {
    console.error("[settings] failed to warm cache:", err);
  }
  return settings;
});

export async function updateSettings(
  patch: Partial<DashboardSettings>,
): Promise<DashboardSettings> {
  const admin = getSupabaseAdmin();

  // Read-modify-write straight against the database, bypassing both the
  // request memo and the cache: within one request a memoized read could be
  // older than the row, and merging onto a stale value would drop a
  // concurrent change to the other field.
  const current = await readFromDatabase();
  const next: DashboardSettings = { ...current, ...patch };

  const { error } = await admin.from("app_settings").upsert(
    {
      id: ROW_ID,
      partner_name: next.partnerName,
      excluded_staff_ids: next.excludedStaffIds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`Failed to save app_settings: ${error.message}`);

  // Write-through, so the next read doesn't serve the pre-update value for
  // the rest of the TTL.
  try {
    await cacheSet(KEY, next, TTL_SECONDS);
  } catch (err) {
    console.error("[settings] failed to refresh cache after update:", err);
  }
  return next;
}
