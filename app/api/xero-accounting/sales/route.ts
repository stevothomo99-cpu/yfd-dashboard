import { NextResponse } from "next/server";
import { fetchTotalRevenue, isXeroAccountingConfigured, XeroAccountingNotConfiguredError } from "@/lib/xeroAccounting";
import { getXpmTimesheets, isXpmConfigured } from "@/lib/xpm";
import { getSettings } from "@/lib/settings";
import { listStaff } from "@/lib/workflow";
import { computeTotalClientHoursInRange } from "@/lib/workOverview";
import { fyYearFor, fyRange } from "@/lib/utils";

interface ResponseBody {
  monthTotal: number;
  fyTotal: number;
  monthHours: number;
  fyHours: number;
  error?: string;
}

// Feeds the /personal "YFD — Sales" KPI tile from YFD's own Xero Accounting
// invoices (what YFD bills its clients) -- replaces the old /api/xpm/sales,
// which read from XPM's invoice.api instead of actual Xero invoicing.
// Hours (from XPM timesheets, practice-wide, internal time excluded) are
// computed over the exact same Month/FY windows as revenue so the tile's
// $/hr figure is a like-for-like ratio, not two different periods divided
// into each other. FY here is the Australian financial year (1 Jul-30 Jun,
// see lib/utils.ts's fyRange), matching every other FY figure in this app --
// this was originally calendar year-to-date, which didn't match and was
// confirmed as wrong.
async function handle(forceRefresh: boolean): Promise<NextResponse<ResponseBody>> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const { start: fyStart } = fyRange(fyYearFor(now));
  const fyStartIso = fyStart.toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  let monthTotal = 0;
  let fyTotal = 0;
  let error: string | undefined;

  if (!isXeroAccountingConfigured()) {
    error = "Xero Accounting not connected yet -- complete /api/xero-accounting/authorize first.";
  } else {
    try {
      [monthTotal, fyTotal] = await Promise.all([
        fetchTotalRevenue(monthStart, today),
        fetchTotalRevenue(fyStartIso, today),
      ]);
    } catch (err) {
      error =
        err instanceof XeroAccountingNotConfiguredError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
    }
  }

  let monthHours = 0;
  let fyHours = 0;
  if (isXpmConfigured()) {
    const settings = await getSettings();
    if (settings.partnerName) {
      try {
        const [staff, timesheets] = await Promise.all([
          listStaff(),
          getXpmTimesheets(settings.partnerName, { forceRefresh }),
        ]);
        const staffIds = staff.filter((s) => s.xpmStaffId).map((s) => s.xpmStaffId as string);
        monthHours = computeTotalClientHoursInRange(timesheets, staffIds, monthStart, today);
        fyHours = computeTotalClientHoursInRange(timesheets, staffIds, fyStartIso, today);
      } catch {
        // leave hours at 0 -- tile still shows revenue without them
      }
    }
  }

  return NextResponse.json({ monthTotal, fyTotal, monthHours, fyHours, error });
}

export async function GET() {
  return handle(false);
}

export async function POST() {
  return handle(true);
}
