import { NextResponse } from "next/server";
import { getHubSpotDeals } from "@/lib/hubspot";

export interface DealKPI {
  dealName: string;
  stage: string;
  amount: number;
  closeDate: string;
}

export interface PipelineMetrics {
  newLeads: number;
  activeDealCount: number;
  activeDealValue: number;
  wonDealsThisMonth: number;
  avgDaysToClose: number;
}

interface ResponseBody {
  focablyED: PipelineMetrics | null;
  siteMargin: PipelineMetrics | null;
  error?: string;
  lastUpdated: string;
}

function parseAmount(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return Number(val) || 0;
  return 0;
}

function calculateDaysBetween(from: string, to: string): number {
  const d1 = new Date(from);
  const d2 = new Date(to);
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function calculateMetrics(deals: any[]): PipelineMetrics {
  const now = new Date();
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const today = now.toISOString().split("T")[0];

  const activeDealStages = ["negotiation", "presentation", "proposal"];
  const wonStages = ["negotiation/won", "won"];

  let newLeads = 0;
  let activeDealCount = 0;
  let activeDealValue = 0;
  let wonDealsThisMonth = 0;
  const daysToCloseDurations: number[] = [];

  for (const deal of deals) {
    const props = deal.properties || {};
    const stage = (props.dealstage || "").toLowerCase();
    const amount = parseAmount(props.amount);
    const closeDate = props.closedate || "";
    const lastModified = props.hs_lastmodifieddate || "";

    // New leads (modified in last 30 days, in early stages)
    if (lastModified) {
      const modDate = new Date(parseInt(lastModified));
      if (modDate > monthAgo && stage.includes("meeting")) {
        newLeads++;
      }
    }

    // Active deals
    if (activeDealStages.some((s) => stage.includes(s))) {
      activeDealCount++;
      activeDealValue += amount;
    }

    // Won this month
    if (wonStages.some((s) => stage.includes(s)) && closeDate) {
      const closeDateObj = new Date(closeDate);
      if (closeDateObj > monthAgo && closeDateObj <= now) {
        wonDealsThisMonth++;
      }
    }

    // Days to close
    if (closeDate && lastModified) {
      const modDate = new Date(parseInt(lastModified));
      const closeDateObj = new Date(closeDate);
      if (closeDateObj >= modDate) {
        daysToCloseDurations.push(calculateDaysBetween(lastModified, closeDate));
      }
    }
  }

  const avgDaysToClose =
    daysToCloseDurations.length > 0
      ? Math.round(
          daysToCloseDurations.reduce((a, b) => a + b, 0) /
            daysToCloseDurations.length
        )
      : 0;

  return {
    newLeads,
    activeDealCount,
    activeDealValue,
    wonDealsThisMonth,
    avgDaysToClose,
  };
}

export async function GET(): Promise<NextResponse<ResponseBody>> {
  try {
    const deals = await getHubSpotDeals(500);

    // For now, split deals by some heuristic or custom property
    // TODO: Update once you clarify pipeline IDs
    // For now, return same data for both as placeholder
    const metrics = calculateMetrics(deals);

    return NextResponse.json({
      focablyED: metrics,
      siteMargin: metrics,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        focablyED: null,
        siteMargin: null,
        error: message,
        lastUpdated: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
