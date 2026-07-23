import ClientsPageClient from "./ClientsPageClient";
import { getClientSummaries, listStaff } from "@/lib/workflow";
import { getSettings } from "@/lib/settings";
import { getXpmTimesheets, isXpmConfigured } from "@/lib/xpm";
import { computeHoursByClient } from "@/lib/workOverview";

// Server entry point for the Clients tile grid -- sourced from the real
// customers/jobs/tasks tables (see lib/workflow.ts's getClientSummaries),
// replacing the old Karbon-derived CLIENT_TILES mock data. Staff list is
// for the manager filter dropdown -- ClientSummary only carries manager
// ids, not names, so the client needs its own id->name lookup.
export default async function ClientsPage() {
  const [tiles, staff] = await Promise.all([getClientSummaries(), listStaff()]);
  const staffOptions = staff
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Hours logged this FY, per client -- keyed by xpm_client_id so
  // ClientsPageClient can attach a figure to each tile. Best-effort: if
  // XPM isn't configured or the fetch fails, tiles just show no hours
  // rather than blocking the whole page.
  let hoursByClientId: Record<string, number> = {};
  if (isXpmConfigured()) {
    const settings = await getSettings();
    if (settings.partnerName) {
      try {
        const timesheets = await getXpmTimesheets(settings.partnerName);
        const staffIds = staff.filter((s) => s.xpmStaffId).map((s) => s.xpmStaffId as string);
        const clientNamesById = new Map(
          tiles.filter((t) => t.xpmClientId).map((t) => [t.xpmClientId as string, t.name]),
        );
        const today = new Date().toISOString().slice(0, 10);
        const byClient = computeHoursByClient(timesheets, staffIds, "fy", today, clientNamesById);
        hoursByClientId = Object.fromEntries(byClient.map((c) => [c.clientId, c.hours]));
      } catch {
        // leave hoursByClientId empty -- tile grid still works without it
      }
    }
  }

  return <ClientsPageClient tiles={tiles} staffOptions={staffOptions} hoursByClientId={hoursByClientId} />;
}
