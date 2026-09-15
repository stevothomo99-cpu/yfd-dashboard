import RevenueByClientPageClient from "./RevenueByClientPageClient";
import { getClientSummaries, listStaff } from "@/lib/workflow";
import { getSettings } from "@/lib/settings";
import { getXpmTimesheets, isXpmConfigured } from "@/lib/xpm";
import type { XpmTimesheet } from "@/types/xpm";

// Raw timesheets (not a pre-aggregated total) are passed down so the client
// component can recompute hours-by-client for whatever date range the admin
// picks, without a round trip -- same pattern as /clients and /timesheets.
// Revenue (from Xero Accounting) is fetched client-side per range instead,
// same as the Clients page's own custom-range slicer, since there's no
// fixed set of periods to prefetch here (the whole point of this report is
// an arbitrary range).
export default async function RevenueByClientReportPage() {
  const [tiles, allStaff, settings] = await Promise.all([getClientSummaries(), listStaff(), getSettings()]);

  const staff = allStaff.filter((s) => s.included);
  const staffIds = staff.filter((s) => s.xpmStaffId).map((s) => s.xpmStaffId as string);

  const clientNamesById: Record<string, string> = {};
  for (const t of tiles) {
    if (t.xpmClientId) clientNamesById[t.xpmClientId] = t.name;
  }

  const clients = tiles.map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name));

  const timesheets = await loadTimesheets(settings.partnerName);

  return (
    <RevenueByClientPageClient
      clients={clients}
      timesheets={timesheets}
      staffIds={staffIds}
      clientNamesById={clientNamesById}
      chargeRatePerHour={settings.chargeRatePerHour}
      costRatePerHour={settings.costRatePerHour}
    />
  );
}

// Best-effort: if XPM isn't configured or the fetch fails, the report just
// shows no hours rather than blocking the whole page.
async function loadTimesheets(partnerName: string): Promise<XpmTimesheet[]> {
  if (!isXpmConfigured() || !partnerName) return [];
  try {
    return await getXpmTimesheets(partnerName);
  } catch {
    return [];
  }
}
