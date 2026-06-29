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

export async function getSettings(): Promise<DashboardSettings> {
  const stored = await cacheGet<DashboardSettings>(KEY);
  if (!stored) return { ...DEFAULTS };
  return {
    partnerName: stored.partnerName ?? DEFAULTS.partnerName,
    excludedStaffIds: stored.excludedStaffIds ?? DEFAULTS.excludedStaffIds,
  };
}

export async function updateSettings(
  patch: Partial<DashboardSettings>,
): Promise<DashboardSettings> {
  const current = await getSettings();
  const next: DashboardSettings = { ...current, ...patch };
  await cacheSet(KEY, next);
  return next;
}
