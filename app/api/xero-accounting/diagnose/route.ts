import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { xeroAccountingFetch, isXeroAccountingConfigured } from "@/lib/xeroAccounting";

// Admin-only debug endpoint -- dumps a small sample of raw Xero Accounting
// /Invoices responses so the assumed shape (Contact.Name, SubTotal, Status,
// and especially the /Date(ms+tz)/ date format) can be confirmed against
// this specific tenant before trusting it for revenue figures. Same
// purpose as /api/xpm/diagnose, but for a completely different Xero
// product/connection -- this session's XPM work repeatedly found
// "documented" API behaviour didn't match reality, so this is checked
// live rather than assumed.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (!isXeroAccountingConfigured()) {
    return NextResponse.json(
      {
        error:
          "Xero Accounting env vars are not fully set (check XERO_ACCOUNTING_CLIENT_ID/SECRET/REFRESH_TOKEN/TENANT_ID).",
      },
      { status: 400 },
    );
  }

  try {
    const raw = await xeroAccountingFetch<Record<string, unknown>>(
      `/Invoices?where=${encodeURIComponent('Type=="ACCREC"')}&page=1`,
    );
    const invoices = Array.isArray(raw.Invoices) ? raw.Invoices : [];
    return NextResponse.json({
      keys: Object.keys(raw),
      count: invoices.length,
      sample: invoices.slice(0, 2),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) });
  }
}
