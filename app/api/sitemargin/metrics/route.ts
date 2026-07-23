import { NextRequest, NextResponse } from "next/server";
import { getSiteMarginSubscriptionMetrics } from "@/lib/sitemargin";
import type { ChurnRange } from "@/lib/utils";

const VALID_RANGES: ChurnRange[] = ["all", "12m", "fy", "month", "week", "24h"];

interface ResponseBody {
  totalOrganizations: number;
  activeTrials: number;
  activeSubscriptions: number;
  trialConversionRate: number;
  canceledOrganizations: number;
  pastDueOrganizations: number;
  paidChurnInPeriod: number;
  untrialChurnInPeriod: number;
  lastUpdated: string;
  note?: string;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ResponseBody>> {
  const rangeParam = request.nextUrl.searchParams.get("range");
  const range: ChurnRange = VALID_RANGES.includes(rangeParam as ChurnRange)
    ? (rangeParam as ChurnRange)
    : "month";

  try {
    const metrics = await getSiteMarginSubscriptionMetrics(range);

    return NextResponse.json({
      ...metrics,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error in /api/sitemargin/metrics:", message);

    return NextResponse.json(
      {
        totalOrganizations: 0,
        activeTrials: 0,
        activeSubscriptions: 0,
        trialConversionRate: 0,
        canceledOrganizations: 0,
        pastDueOrganizations: 0,
        paidChurnInPeriod: 0,
        untrialChurnInPeriod: 0,
        lastUpdated: new Date().toISOString(),
        error: message,
      },
      { status: 502 }
    );
  }
}
