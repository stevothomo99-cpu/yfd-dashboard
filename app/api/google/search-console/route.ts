import { NextResponse, NextRequest } from "next/server";
import { getSearchConsoleMetrics } from "@/lib/google";
import { requireAdmin } from "@/lib/routeAuth";

// Feeds the admin-only "Business KPIs" page (/personal) -- was previously
// reachable by anyone, logged in or not.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const days = request.nextUrl.searchParams.get("days")
      ? parseInt(request.nextUrl.searchParams.get("days")!)
      : 30;

    const siteMarginMetrics = await getSearchConsoleMetrics(
      "sc-domain:sitemargin.com.au",
      { days }
    );

    let focablyMetrics = null;
    try {
      focablyMetrics = await getSearchConsoleMetrics(
        "https://focablyed.com/",
        { days }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[SearchConsole API Error] FocablyED", message);
    }

    let yfdMetrics = null;
    try {
      yfdMetrics = await getSearchConsoleMetrics(
        "sc-domain:yourfinancedept.com.au",
        { days }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[SearchConsole API Error] YFD", message);
    }

    return NextResponse.json({
      siteMargin: siteMarginMetrics,
      focablyED: focablyMetrics,
      yfd: yfdMetrics,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[SearchConsole API Error]", message);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    return NextResponse.json(
      {
        siteMargin: null,
        focablyED: null,
        yfd: null,
        error: `Search Console API error: ${message}`,
        lastUpdated: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
