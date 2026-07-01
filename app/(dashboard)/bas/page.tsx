import BasPageClient from "./BasPageClient";
import {
  getKarbonWorkItems,
  isKarbonConfigured,
  KarbonNotConfiguredError,
  loadKarbonUsersSnapshot,
} from "@/lib/karbon";
import { getSettings } from "@/lib/settings";
import { WORK_ITEMS, KARBON_USERS } from "@/lib/mock";
import type { KarbonWorkItem } from "@/types/karbon";

export interface BasSnapshot {
  mode: "live" | "mock";
  workItems: KarbonWorkItem[];
  syncedAt: string;
  basWorkTypeFilter: string | null;
  message?: string;
}

async function loadSnapshot(): Promise<BasSnapshot> {
  const settings = await getSettings();
  const excluded = settings.excludedStaffIds;
  const basWorkTypeFilter = process.env.KARBON_BAS_WORK_TYPE ?? null;

  if (!isKarbonConfigured()) {
    return {
      mode: "mock",
      workItems: WORK_ITEMS.filter((w) => !excluded.includes(w.assigneeId)),
      syncedAt: new Date().toISOString(),
      basWorkTypeFilter,
      message: "Showing mock data because KARBON_API_KEY is not set.",
    };
  }

  try {
    const workItems = await getKarbonWorkItems(excluded);
    return { mode: "live", workItems, syncedAt: new Date().toISOString(), basWorkTypeFilter };
  } catch (err) {
    if (err instanceof KarbonNotConfiguredError) {
      return {
        mode: "mock",
        workItems: WORK_ITEMS.filter((w) => !excluded.includes(w.assigneeId)),
        syncedAt: new Date().toISOString(),
        basWorkTypeFilter,
        message: err.message,
      };
    }
    return {
      mode: "live",
      workItems: [],
      syncedAt: new Date().toISOString(),
      basWorkTypeFilter,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export default async function BasPage() {
  const settings = await getSettings();
  const [snapshot, staff] = await Promise.all([
    loadSnapshot(),
    loadKarbonUsersSnapshot(settings.excludedStaffIds, KARBON_USERS),
  ]);
  return <BasPageClient initial={snapshot} staff={staff.users} />;
}
