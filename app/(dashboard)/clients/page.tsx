import ClientsPageClient from "./ClientsPageClient";
import { getClientSummaries, listStaff } from "@/lib/workflow";
import { getSettings } from "@/lib/settings";
import { getXpmTimesheets, isXpmConfigured } from "@/lib/xpm";
import type { XpmTimesheet } from "@/types/xpm";

// Server entry point for the Clients tile grid -- sourced from the real
// customers/jobs/tasks tables (see lib/workflow.ts's getClientSummaries),
// replacing the old Karbon-derived CLIENT_TILES mock data. Staff list is
// for the manager filter dropdown -- ClientSummary only carries manager
// ids, not names, so the client needs its own id->name lookup.
//
// Raw timesheets (not a pre-computed hours-by-client total) are passed down
// so ClientsPageClient can offer a This Week/Month/Quarter/FY slicer and
// recompute client-side without a round trip -- same pattern as
// /timesheets. Best-effort: if XPM isn't configured or the fetch fails,
// tiles just show no hours rather than blocking the whole page.
export default async function ClientsPage() {
  const [tiles, staff] = await Promise.all([getClientSummaries(), listStaff()]);
  const staffOptions = staff
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const clientNamesById: Record<string, string> = {};
  for (const t of tiles) {
    if (t.xpmClientId) clientNamesById[t.xpmClientId] = t.name;
  }

  let timesheets: XpmTimesheet[] = [];
  const staffIds = staff.filter((s) => s.xpmStaffId).map((s) => s.xpmStaffId as string);
  if (isXpmConfigured()) {
    const settings = await getSettings();
    if (settings.partnerName) {
      try {
        timesheets = await getXpmTimesheets(settings.partnerName);
      } catch {
        // leave timesheets empty -- tile grid still works without hours
      }
    }
  }

  return (
    <ClientsPageClient
      tiles={tiles}
      staffOptions={staffOptions}
      timesheets={timesheets}
      staffIds={staffIds}
      clientNamesById={clientNamesById}
    />
  );
}
