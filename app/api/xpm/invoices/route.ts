import { NextResponse } from "next/server";
import { getXpmInvoices, isXpmConfigured, XpmNotConfiguredError } from "@/lib/xpm";
import { getSettings } from "@/lib/settings";
import { INVOICES } from "@/lib/mock";
import type { XpmInvoice } from "@/types/xpm";

interface ResponseBody {
  mode: "live" | "mock";
  invoices: XpmInvoice[];
  syncedAt: string;
  message?: string;
}

async function handle(forceRefresh: boolean): Promise<NextResponse<ResponseBody>> {
  const settings = await getSettings();

  if (!isXpmConfigured()) {
    return NextResponse.json({
      mode: "mock",
      invoices: INVOICES,
      syncedAt: new Date().toISOString(),
      message:
        "Returned mock data because XPM_CLIENT_ID, XPM_CLIENT_SECRET, XPM_REFRESH_TOKEN, or XPM_TENANT_ID are not set.",
    });
  }

  if (!settings.partnerName) {
    return NextResponse.json({
      mode: "live",
      invoices: [],
      syncedAt: new Date().toISOString(),
      message: "No Partner name configured in Settings — set it and re-sync.",
    });
  }

  try {
    const invoices = await getXpmInvoices(settings.partnerName, { forceRefresh });
    return NextResponse.json({ mode: "live", invoices, syncedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof XpmNotConfiguredError) {
      return NextResponse.json({
        mode: "mock",
        invoices: INVOICES,
        syncedAt: new Date().toISOString(),
        message: err.message,
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { mode: "live", invoices: [], syncedAt: new Date().toISOString(), message },
      { status: 502 },
    );
  }
}

export async function GET() {
  return handle(false);
}

export async function POST() {
  return handle(true);
}
