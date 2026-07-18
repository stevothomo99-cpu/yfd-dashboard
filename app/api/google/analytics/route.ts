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
  yfd: {
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

    const siteMarginMetrics = await getAnalyticsMetrics(
      process.env.SITEMARGIN_GA4_PROPERTY_ID || "544627080",
      { days }
    );

    let focablyMetrics = null;
    try {
      focablyMetrics = await getAnalyticsMetrics(
        process.env.FOCABLYED_GA4_PROPERTY_ID || "546068683",
        { days }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[Analytics API Error] FocablyED", message);
    }

    let yfdMetrics = null;
    if (process.env.YFD_GA4_PROPERTY_ID) {
      try {
        yfdMetrics = await getAnalyticsMetrics(process.env.YFD_GA4_PROPERTY_ID, {
          days,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[Analytics API Error] YFD", message);
      }
    }

    return NextResponse.json({
      siteMargin: siteMarginMetrics,
      focablyED: focablyMetrics,
      yfd: yfdMetrics,
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
        yfd: null,
        error: `Analytics API error: ${message}`,
        lastUpdated: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
