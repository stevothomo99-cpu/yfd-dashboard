import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { getRevenueByClientName, isXeroAccountingConfigured } from "@/lib/xeroAccounting";

// Paging full invoice bodies takes a while on a cold cache (see
// fetchAllInvoicesInRange -- `where` + summaryOnly can't be combined once the
// filter has Date/Status conditions, so there's no lighter call available).
export const maxDuration = 120;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Revenue by client for an arbitrary date range.
//
// The Clients page prefetches revenue server-side for the four fixed period
// buttons, which is why its slicer feels instant. A custom range can't be
// prefetched -- it isn't known until the user picks it -- so it's fetched
// here on demand instead. Same cached, stale-while-revalidate loader the
// prefetch uses, so repeat ranges are cheap.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isXeroAccountingConfigured()) {
    return NextResponse.json({ revenue: [], message: "Xero Accounting isn't configured." });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return NextResponse.json(
      { error: "from and to are required as yyyy-mm-dd." },
      { status: 400 },
    );
  }
  // Tolerate a reversed range rather than rejecting it -- the date inputs let
  // you pick either order, and the page swaps them the same way.
  const [start, end] = from <= to ? [from, to] : [to, from];

  try {
    const revenue = await getRevenueByClientName(start, end);
    return NextResponse.json({ revenue });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load revenue.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
