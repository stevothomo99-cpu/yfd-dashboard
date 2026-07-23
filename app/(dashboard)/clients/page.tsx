import ClientsPageClient from "./ClientsPageClient";
import { getClientSummaries, listStaff } from "@/lib/workflow";
import { getSettings } from "@/lib/settings";
import { getXpmTimesheets, isXpmConfigured } from "@/lib/xpm";
import { getRevenueByClientName, isXeroAccountingConfigured } from "@/lib/xeroAccounting";
import { periodBounds, UTILISATION_PERIODS, type UtilisationPeriodKey } from "@/lib/workOverview";
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
//
// Revenue (from Xero Accounting, not XPM invoicing) is prefetched for all
// four period buttons up front -- rather than a client-side fetch per
// toggle -- so the slicer feels instant and matches the hours side, which
// is already all-periods-at-once from the raw timesheets array. Matched to
// XPM clients by exact name (confirmed decision -- no stored link between
// an XPM client and a Xero Accounting contact).
export default async function ClientsPage() {
  const [tiles, staff] = await Promise.all([getClientSummaries(), listStaff()]);
  const staffOptions = staff
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const clientNamesById: Record<string, string> = {};
  for (const t of tiles) {
    if (t.xpmClientId) clientNamesById[t.xpmClientId] = t.name;
  }
  const tileIdByName = new Map(tiles.map((t) => [t.name, t.id]));

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

  const revenueByPeriodByClientId: Record<UtilisationPeriodKey, Record<string, number>> = {
    week: {},
    month: {},
    quarter: {},
    fy: {},
  };
  if (isXeroAccountingConfigured()) {
    const today = new Date();
    try {
      const revenueByPeriod = await Promise.all(
        UTILISATION_PERIODS.map(({ value }) => {
          const { start, end } = periodBounds(value, today);
          return getRevenueByClientName(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
        }),
      );
      UTILISATION_PERIODS.forEach(({ value }, i) => {
        const byClientId: Record<string, number> = {};
        for (const { clientName, revenue } of revenueByPeriod[i]) {
          const clientId = tileIdByName.get(clientName);
          if (clientId) byClientId[clientId] = revenue;
        }
        revenueByPeriodByClientId[value] = byClientId;
      });
    } catch {
      // leave revenueByPeriodByClientId empty -- tile grid still works without revenue
    }
  }

  return (
    <ClientsPageClient
      tiles={tiles}
      staffOptions={staffOptions}
      timesheets={timesheets}
      staffIds={staffIds}
      clientNamesById={clientNamesById}
      revenueByPeriodByClientId={revenueByPeriodByClientId}
    />
  );
}
