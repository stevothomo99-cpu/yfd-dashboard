import SettingsPageClient from "./SettingsPageClient";
import { getSettings } from "@/lib/settings";
import { getXpmStaff, isXpmConfigured, XpmNotConfiguredError } from "@/lib/xpm";
import { loadKarbonUsersSnapshot } from "@/lib/karbon";
import { linkKarbonToXpmByEmail, type LinkedStaff } from "@/lib/staffLink";
import { STAFF, KARBON_USERS } from "@/lib/mock";
import type { XpmStaff } from "@/types/xpm";

export interface RosterEntry extends LinkedStaff {
  included: boolean;
}

export interface SettingsSnapshot {
  karbonMode: "live" | "mock";
  xpmMode: "live" | "mock";
  partnerName: string;
  roster: RosterEntry[];
  syncedAt: string;
  karbonMessage?: string;
  xpmMessage?: string;
}

// Same email convention as lib/mock's KARBON_USERS, so the two mock rosters
// link by email out of the box.
function mockXpmStaff(): XpmStaff[] {
  return STAFF.map((s) => ({
    id: s.id,
    name: s.name,
    email: `${s.id}@yfd.example`,
    role: "Manager" as const,
    included: true,
  }));
}

async function loadXpmStaffSnapshot(
  partnerName: string,
): Promise<{ mode: "live" | "mock"; staff: XpmStaff[]; message?: string }> {
  if (!isXpmConfigured()) {
    return {
      mode: "mock",
      staff: mockXpmStaff(),
      message:
        "Showing mock data because XPM_CLIENT_ID, XPM_CLIENT_SECRET, XPM_REFRESH_TOKEN, or XPM_TENANT_ID are not set.",
    };
  }
  if (!partnerName) {
    return { mode: "live", staff: [], message: "Set a Partner name and sync to load staff from XPM." };
  }
  try {
    const staff = await getXpmStaff(partnerName);
    return { mode: "live", staff };
  } catch (err) {
    if (err instanceof XpmNotConfiguredError) {
      return { mode: "mock", staff: mockXpmStaff(), message: err.message };
    }
    return { mode: "live", staff: [], message: err instanceof Error ? err.message : "Unknown error" };
  }
}

export default async function SettingsPage() {
  const settings = await getSettings();

  // Load the full, unfiltered Karbon roster (not exclusion-filtered) so the
  // toggle list can show everyone, including people currently excluded.
  const [karbonSnapshot, xpmSnapshot] = await Promise.all([
    loadKarbonUsersSnapshot([], KARBON_USERS),
    loadXpmStaffSnapshot(settings.partnerName),
  ]);

  const linked = linkKarbonToXpmByEmail(karbonSnapshot.users, xpmSnapshot.staff);
  const roster: RosterEntry[] = linked.map((l) => ({
    ...l,
    included:
      !settings.excludedStaffIds.includes(l.karbonId) &&
      !(l.xpmId ? settings.excludedStaffIds.includes(l.xpmId) : false),
  }));

  return (
    <SettingsPageClient
      initial={{
        karbonMode: karbonSnapshot.mode,
        xpmMode: xpmSnapshot.mode,
        partnerName: settings.partnerName,
        roster,
        syncedAt: new Date().toISOString(),
        karbonMessage: karbonSnapshot.message,
        xpmMessage: xpmSnapshot.message,
      }}
    />
  );
}
