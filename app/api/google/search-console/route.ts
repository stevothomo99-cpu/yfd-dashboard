import { NextResponse } from "next/server";
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
  error?: string;
  lastUpdated: string;
}

export async function GET(): Promise<NextResponse<ResponseBody>> {
  try {
    const siteMarginMetrics = await getSearchConsoleMetrics(
      "https://www.sitemargin.com.au/"
    );

    // TODO: Add FocablyED Search Console metrics once domain is verified
    // const focablyMetrics = await getSearchConsoleMetrics("https://www.focablyED.com/");

    return NextResponse.json({
      siteMargin: siteMarginMetrics,
      focablyED: null,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        siteMargin: null,
        focablyED: null,
        error: message,
        lastUpdated: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
