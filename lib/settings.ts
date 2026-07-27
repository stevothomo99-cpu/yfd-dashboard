import { cache } from "react";
import { cacheGet, cacheSet } from "./cache";

const KEY = "settings";

export interface DashboardSettings {
  partnerName: string;
  excludedStaffIds: string[];
}

const DEFAULTS: DashboardSettings = {
  partnerName: "",
  excludedStaffIds: [],
};

// Memoized per-request (React cache()): several pages read settings from
// more than one place in a single render, and each read is a Redis round
// trip. Not a cross-request cache -- a settings PATCH is still visible on
// the very next request.
export const getSettings = cache(async function getSettings(): Promise<DashboardSettings> {
  const stored = await cacheGet<DashboardSettings>(KEY);
  if (!stored) return { ...DEFAULTS };
  return {
    partnerName: stored.partnerName ?? DEFAULTS.partnerName,
    excludedStaffIds: stored.excludedStaffIds ?? DEFAULTS.excludedStaffIds,
  };
});

export async function updateSettings(
  patch: Partial<DashboardSettings>,
): Promise<DashboardSettings> {
  // Deliberately bypasses the memoized getSettings above -- within a single
  // request a read-modify-write must see the current stored value, not one
  // memoized earlier in that same request.
  const stored = await cacheGet<DashboardSettings>(KEY);
  const current: DashboardSettings = {
    partnerName: stored?.partnerName ?? DEFAULTS.partnerName,
    excludedStaffIds: stored?.excludedStaffIds ?? DEFAULTS.excludedStaffIds,
  };
  const next: DashboardSettings = { ...current, ...patch };
  await cacheSet(KEY, next);
  return next;
}
