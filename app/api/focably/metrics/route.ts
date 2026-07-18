import { NextRequest, NextResponse } from "next/server";
import { getFocablySubscriptionMetrics } from "@/lib/focably";
import type { ChurnRange } from "@/lib/utils";

const VALID_RANGES: ChurnRange[] = ["all", "12m", "fy", "month", "week", "24h"];

interface ResponseBody {
  totalUsers: number;
  paidUsers: number;
  freemiumUsers: number;
  nonActiveUsers: number;
  paidChurnInPeriod: number;
  unpaidChurnInPeriod: number;
  totalChurnInPeriod: number;
  churnRate: number;
  winBackCandidates: number;
  lastUpdated: string;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ResponseBody>> {
  const rangeParam = request.nextUrl.searchParams.get("range");
  const range: ChurnRange = VALID_RANGES.includes(rangeParam as ChurnRange)
    ? (rangeParam as ChurnRange)
    : "month";

  try {
    const metrics = await getFocablySubscriptionMetrics(range);

    return NextResponse.json({
      ...metrics,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error in /api/focably/metrics:", message);

    return NextResponse.json(
      {
        totalUsers: 0,
        paidUsers: 0,
        freemiumUsers: 0,
        nonActiveUsers: 0,
        paidChurnInPeriod: 0,
        unpaidChurnInPeriod: 0,
        totalChurnInPeriod: 0,
        churnRate: 0,
        winBackCandidates: 0,
        lastUpdated: new Date().toISOString(),
        error: message,
      },
      { status: 502 }
    );
  }
}
