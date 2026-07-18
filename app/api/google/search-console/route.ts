import { NextResponse, NextRequest } from "next/server";
import { getSearchConsoleMetrics } from "@/lib/google";

interface ResponseBody {
  siteMargin: {
    clicks: number;
    impressions: number;
    ctr: number;
    avgPosition: number;
    topQueries: Array<{ query: string; clicks: number; impressions: number }>;
  } | null;
  focablyED: {
    clicks: number;
    impressions: number;
    ctr: number;
    avgPosition: number;
    topQueries: Array<{ query: string; clicks: number; impressions: number }>;
  } | null;
  yfd: {
    clicks: number;
    impressions: number;
    ctr: number;
    avgPosition: number;
    topQueries: Array<{ query: string; clicks: number; impressions: number }>;
  } | null;
  error?: string;
  lastUpdated: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ResponseBody>> {
  try {
    const days = request.nextUrl.searchParams.get("days")
      ? parseInt(request.nextUrl.searchParams.get("days")!)
      : 30;

    const siteMarginMetrics = await getSearchConsoleMetrics(
      "sc-domain:sitemargin.com.au",
      { days }
    );

    // TODO: Add FocablyED Search Console metrics once domain is verified
    // const focablyMetrics = await getSearchConsoleMetrics("sc-domain:focablyed.com");

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
      focablyED: null,
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
