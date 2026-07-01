import SettingsPageClient from "./SettingsPageClient";
import { getSettings, type DashboardSettings } from "@/lib/settings";
import { getXpmStaff, isXpmConfigured, XpmNotConfiguredError } from "@/lib/xpm";
import { STAFF } from "@/lib/mock";
import type { XpmStaff } from "@/types/xpm";

export interface StaffSnapshot {
  mode: "live" | "mock";
  partnerName: string;
  staff: XpmStaff[];
  syncedAt: string;
  message?: string;
}

function applyExclusions(staff: XpmStaff[], excludedStaffIds: string[]): XpmStaff[] {
  return staff.map((s) => ({ ...s, included: !excludedStaffIds.includes(s.id) }));
}

function mockStaff(excludedStaffIds: string[]): XpmStaff[] {
  return applyExclusions(
    STAFF.map((s) => ({
      id: s.id,
      name: s.name,
      email: `${s.id}@yfd.example`,
      role: "Manager" as const,
      included: true,
    })),
    excludedStaffIds,
  );
}

async function loadStaffSnapshot(settings: DashboardSettings): Promise<StaffSnapshot> {
  const excluded = settings.excludedStaffIds;

  if (!isXpmConfigured()) {
    return {
      mode: "mock",
      partnerName: settings.partnerName,
      staff: mockStaff(excluded),
      syncedAt: new Date().toISOString(),
      message:
        "Showing mock data because XPM_CLIENT_ID, XPM_CLIENT_SECRET, XPM_REFRESH_TOKEN, or XPM_TENANT_ID are not set.",
    };
  }

  if (!settings.partnerName) {
    return {
      mode: "live",
      partnerName: "",
      staff: [],
      syncedAt: new Date().toISOString(),
      message: "Set a Partner name and sync to load staff from XPM.",
    };
  }

  try {
    const staff = await getXpmStaff(settings.partnerName);
    return {
      mode: "live",
      partnerName: settings.partnerName,
      staff: applyExclusions(staff, excluded),
      syncedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof XpmNotConfiguredError) {
      return {
        mode: "mock",
        partnerName: settings.partnerName,
        staff: mockStaff(excluded),
        syncedAt: new Date().toISOString(),
        message: err.message,
      };
    }
    return {
      mode: "live",
      partnerName: settings.partnerName,
      staff: [],
      syncedAt: new Date().toISOString(),
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export default async function SettingsPage() {
  const settings = await getSettings();
  const staffSnapshot = await loadStaffSnapshot(settings);
  return <SettingsPageClient initialStaff={staffSnapshot} />;
}
