import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { xeroAccountingFetch, xeroAccountingFetchForTenant, isXeroAccountingConfigured } from "@/lib/xeroAccounting";

// Admin-only debug endpoint -- dumps a small sample of raw Xero Accounting
// /Invoices responses so the assumed shape (Contact.Name, SubTotal, Status,
// and especially the /Date(ms+tz)/ date format) can be confirmed against
// this specific tenant before trusting it for revenue figures. Same
// purpose as /api/xpm/diagnose, but for a completely different Xero
// product/connection -- this session's XPM work repeatedly found
// "documented" API behaviour didn't match reality, so this is checked
// live rather than assumed.
//
// Pass ?tenantIds=id1,id2 to compare candidate tenants directly (e.g. a
// Xero login with more than one organisation) instead of only checking
// whatever XERO_ACCOUNTING_TENANT_ID currently is -- each tenant's real
// organisation Name plus an invoice count/sample, so it's obvious which one
// actually has real invoice history without changing env vars first.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const tenantIdsParam = request.nextUrl.searchParams.get("tenantIds");
  if (tenantIdsParam) {
    const tenantIds = tenantIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
    const results = await Promise.all(
      tenantIds.map(async (tenantId) => {
        try {
          const [org, invoiceData] = await Promise.all([
            xeroAccountingFetchForTenant<{ Organisations?: { Name?: string; LegalName?: string }[] }>(
              tenantId,
              "/Organisation",
            ),
            xeroAccountingFetchForTenant<Record<string, unknown>>(
              tenantId,
              `/Invoices?where=${encodeURIComponent('Type=="ACCREC"')}&page=1&summaryOnly=true`,
            ),
          ]);
          const invoices = Array.isArray(invoiceData.Invoices) ? invoiceData.Invoices : [];
          return {
            tenantId,
            organisationName: org.Organisations?.[0]?.Name ?? null,
            legalName: org.Organisations?.[0]?.LegalName ?? null,
            invoiceCount: invoices.length,
            sample: invoices.slice(0, 2),
          };
        } catch (err) {
          return { tenantId, error: err instanceof Error ? err.message : String(err) };
        }
      }),
    );
    return NextResponse.json({ tenants: results });
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
