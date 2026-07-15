import { NextResponse } from "next/server";
import { getFocablySubscriptionMetrics } from "@/lib/focably";

interface ResponseBody {
  totalUsers: number;
  paidUsers: number;
  freemiumUsers: number;
  nonActiveUsers: number;
  paidChurnThisMonth: number;
  unpaidChurnThisMonth: number;
  totalChurnThisMonth: number;
  churnRate: number;
  winBackCandidates: number;
  lastUpdated: string;
  error?: string;
}

export async function GET(): Promise<NextResponse<ResponseBody>> {
  try {
    const metrics = await getFocablySubscriptionMetrics();

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
        paidChurnThisMonth: 0,
        unpaidChurnThisMonth: 0,
        totalChurnThisMonth: 0,
        churnRate: 0,
        winBackCandidates: 0,
        lastUpdated: new Date().toISOString(),
        error: message,
      },
      { status: 502 }
    );
  }
}
