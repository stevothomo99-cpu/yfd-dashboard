import { NextResponse } from "next/server";
import { fetchTotalRevenue, isXeroAccountingConfigured, XeroAccountingNotConfiguredError } from "@/lib/xeroAccounting";

interface ResponseBody {
  monthTotal: number;
  ytdTotal: number;
  error?: string;
}

// Feeds the /personal "YFD — Sales" KPI tile from YFD's own Xero Accounting
// invoices (what YFD bills its clients) -- replaces the old /api/xpm/sales,
// which read from XPM's invoice.api instead of actual Xero invoicing.
async function handle(): Promise<NextResponse<ResponseBody>> {
  if (!isXeroAccountingConfigured()) {
    return NextResponse.json({
      monthTotal: 0,
      ytdTotal: 0,
      error: "Xero Accounting not connected yet -- complete /api/xero-accounting/authorize first.",
    });
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  try {
    const [monthTotal, ytdTotal] = await Promise.all([
      fetchTotalRevenue(monthStart, today),
      fetchTotalRevenue(yearStart, today),
    ]);
    return NextResponse.json({ monthTotal, ytdTotal });
  } catch (err) {
    if (err instanceof XeroAccountingNotConfiguredError) {
      return NextResponse.json({ monthTotal: 0, ytdTotal: 0, error: err.message });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ monthTotal: 0, ytdTotal: 0, error: message }, { status: 502 });
  }
}

export async function GET() {
  return handle();
}

export async function POST() {
  return handle();
}
