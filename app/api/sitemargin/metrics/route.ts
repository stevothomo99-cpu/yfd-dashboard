import { NextResponse } from "next/server";
import { getSiteMarginSubscriptionMetrics } from "@/lib/sitemargin";

interface ResponseBody {
  totalOrganizations: number;
  activeTrials: number;
  activeSubscriptions: number;
  trialConversionRate: number;
  canceledOrganizations: number;
  pastDueOrganizations: number;
  paidChurnThisMonth: number;
  untrialChurnThisMonth: number;
  lastUpdated: string;
  note?: string;
  error?: string;
}

export async function GET(): Promise<NextResponse<ResponseBody>> {
  try {
    const metrics = await getSiteMarginSubscriptionMetrics();

    return NextResponse.json({
      ...metrics,
      lastUpdated: new Date().toISOString(),
      note: "Churn data (subscription_canceled, trial_expired) available after Phase 2 (Stripe) ships. Currently showing trial_started only.",
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
        paidChurnThisMonth: 0,
        untrialChurnThisMonth: 0,
        lastUpdated: new Date().toISOString(),
        error: message,
      },
      { status: 502 }
    );
  }
}
