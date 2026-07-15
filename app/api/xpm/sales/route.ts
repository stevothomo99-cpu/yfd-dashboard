import { NextResponse } from "next/server";
import { getXpmInvoices, isXpmConfigured, XpmNotConfiguredError } from "@/lib/xpm";
import { getSettings } from "@/lib/settings";

interface ResponseBody {
  monthTotal: number;
  ytdTotal: number;
  error?: string;
}

async function handle(forceRefresh: boolean): Promise<NextResponse<ResponseBody>> {
  const settings = await getSettings();

  if (!isXpmConfigured()) {
    return NextResponse.json({
      monthTotal: 0,
      ytdTotal: 0,
      error: "XPM not configured",
    });
  }

  if (!settings.partnerName) {
    return NextResponse.json({
      monthTotal: 0,
      ytdTotal: 0,
      error: "No Partner name configured in Settings",
    });
  }

  try {
    const invoices = await getXpmInvoices(settings.partnerName, { forceRefresh });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let monthTotal = 0;
    let ytdTotal = 0;

    for (const invoice of invoices) {
      if (!invoice.date) continue;

      const invoiceDate = new Date(invoice.date + "T00:00:00Z");
      const invoiceYear = invoiceDate.getFullYear();
      const invoiceMonth = invoiceDate.getMonth();

      // YTD: sum invoices from Jan 1 to today of current year
      if (invoiceYear === currentYear) {
        ytdTotal += invoice.amount;
      }

      // Month: sum invoices from the 1st to today of current month
      if (invoiceYear === currentYear && invoiceMonth === currentMonth) {
        monthTotal += invoice.amount;
      }
    }

    return NextResponse.json({ monthTotal, ytdTotal });
  } catch (err) {
    if (err instanceof XpmNotConfiguredError) {
      return NextResponse.json({
        monthTotal: 0,
        ytdTotal: 0,
        error: err.message,
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { monthTotal: 0, ytdTotal: 0, error: message },
      { status: 502 }
    );
  }
}

export async function GET() {
  return handle(false);
}

export async function POST() {
  return handle(true);
}
