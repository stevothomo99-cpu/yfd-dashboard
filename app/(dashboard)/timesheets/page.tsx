import TimesheetsPageClient from "./TimesheetsPageClient";
import { listStaff, getClientSummaries } from "@/lib/workflow";
import { getSettings } from "@/lib/settings";
import { getXpmTimesheets, isXpmConfigured } from "@/lib/xpm";
import type { XpmTimesheet } from "@/types/xpm";

// Server entry point for /timesheets -- replaces the old fully-mock page
// (dummy includedStaff() roster, hardcoded WEEKLY_TARGET_PER_STAFF and
// month/YTD multipliers) with the real 38hr/Leave-aware calc from
// lib/workOverview.ts, fed by live XPM timesheets and the real staff
// roster.
export default async function TimesheetsPage() {
  const [staff, clients, settings] = await Promise.all([
    listStaff(),
    getClientSummaries(),
    getSettings(),
  ]);

  const clientNamesById: Record<string, string> = {};
  for (const c of clients) {
    if (c.xpmClientId) clientNamesById[c.xpmClientId] = c.name;
  }

  let timesheets: XpmTimesheet[] = [];
  let message: string | null = null;

  if (!isXpmConfigured()) {
    message = "XPM isn't configured (XPM_CLIENT_ID etc. not set) -- no timesheet data to show.";
  } else if (!settings.partnerName) {
    message = "Set a Partner name in Settings to sync XPM timesheets.";
  } else {
    try {
      timesheets = await getXpmTimesheets(settings.partnerName);
    } catch (err) {
      message = err instanceof Error ? err.message : "Failed to load timesheets from XPM.";
    }
  }

  const staffOptions = staff
    .filter((s): s is typeof s & { xpmStaffId: string } => Boolean(s.xpmStaffId))
    .map((s) => ({ id: s.xpmStaffId, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <TimesheetsPageClient
      timesheets={timesheets}
      staffOptions={staffOptions}
      clientNamesById={clientNamesById}
      message={message}
    />
  );
}
