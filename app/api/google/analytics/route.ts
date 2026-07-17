import { NextResponse, NextRequest } from "next/server";
import { getAnalyticsMetrics } from "@/lib/google";

interface ResponseBody {
  siteMargin: {
    sessions: number;
    users: number;
    pageviews: number;
    bounceRate: number;
  } | null;
  focablyED: {
    sessions: number;
    users: number;
    pageviews: number;
    bounceRate: number;
  } | null;
  error?: string;
  lastUpdated: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ResponseBody>> {
  try {
    const days = request.nextUrl.searchParams.get("days")
      ? parseInt(request.nextUrl.searchParams.get("days")!)
      : 30;

    const siteMarginMetrics = await getAnalyticsMetrics("544627080", { days });

    // TODO: Add FocablyED analytics once GA4 property ID is confirmed
    // const focablyMetrics = await getAnalyticsMetrics("FOCABLY_GA4_PROPERTY_ID");

    return NextResponse.json({
      siteMargin: siteMarginMetrics,
      focablyED: null,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Analytics API Error]", message);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    return NextResponse.json(
      {
        siteMargin: null,
        focablyED: null,
        error: `Analytics API error: ${message}`,
        lastUpdated: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
