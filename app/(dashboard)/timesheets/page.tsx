import TimesheetsPageClient from "./TimesheetsPageClient";
import { listStaff, getClientSummaries } from "@/lib/workflow";
import { getSettings } from "@/lib/settings";
import { getXpmTimesheets, getXpmClientDirectory, isXpmConfigured } from "@/lib/xpm";
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

  let timesheets: XpmTimesheet[] = [];
  let message: string | null = null;
  let directory: Awaited<ReturnType<typeof getXpmClientDirectory>> = {};

  if (!isXpmConfigured()) {
    message = "XPM isn't configured (XPM_CLIENT_ID etc. not set) -- no timesheet data to show.";
  } else if (!settings.partnerName) {
    message = "Set a Partner name in Settings to sync XPM timesheets.";
  } else {
    // Both hit XPM and neither depends on the other, so they're started
    // together rather than one after the other.
    const [timesheetResult, directoryResult] = await Promise.allSettled([
      getXpmTimesheets(settings.partnerName),
      getXpmClientDirectory(),
    ]);

    if (timesheetResult.status === "fulfilled") {
      timesheets = timesheetResult.value;
    } else {
      const err = timesheetResult.reason;
      message = err instanceof Error ? err.message : "Failed to load timesheets from XPM.";
    }

    // Best-effort: without the directory, unresolved ids stay "Unknown
    // client" -- the same behaviour as before it existed. Not worth
    // blocking the page over.
    if (directoryResult.status === "fulfilled") directory = directoryResult.value;
  }

  // Names come from our synced customers first. But staff can log time in
  // XPM against clients that never synced -- a client whose Account Manager
  // isn't the configured Partner, or has none set at all, is excluded by
  // fetchActiveXpmClientsForPartner and so has no row here. Those rendered
  // as "Unknown client" with no way to tell which client it actually was.
  //
  // The tenant-wide XPM directory fills those gaps, and says *why* each one
  // was missing -- an allocation gap to fix in XPM (see
  // /api/xpm/client-allocations), not a dashboard problem.
  const clientNamesById: Record<string, string> = {};
  for (const c of clients) {
    if (c.xpmClientId) clientNamesById[c.xpmClientId] = c.name;
  }
  for (const [id, entry] of Object.entries(directory)) {
    if (clientNamesById[id]) continue;
    clientNamesById[id] = entry.accountManagerName
      ? `${entry.name} — allocated to ${entry.accountManagerName}`
      : `${entry.name} — no Account Manager in XPM`;
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
