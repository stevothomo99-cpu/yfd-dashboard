import { NextResponse } from "next/server";
import { getHubSpotDeals, type HubSpotDeal } from "@/lib/hubspot";

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

// Real pipeline/stage ids, read off /api/hubspot/pipelines-diagnose against
// the live account -- HubSpot's API returns dealstage as this kind of raw
// numeric id, never a human label, which is why the previous version's
// stage.includes("meeting"/"won"/etc) checks could never match anything.
// Every deal also carries a `pipeline` property, which the previous version
// never requested or split on -- FocablyED and SiteMargin rendered the same
// numbers because they were, literally, the same numbers.
const PIPELINES: Record<"focablyED" | "siteMargin", { id: string; closedStageIds: Set<string>; wonStageId: string }> = {
  focablyED: {
    id: "default",
    // "Closed Lost" carries the id "closedwon" in this account (a HubSpot
    // data quirk, not a typo here) -- confirmed directly via the diagnostic.
    closedStageIds: new Set(["3412465131", "closedwon"]),
    wonStageId: "3412465131",
  },
  siteMargin: {
    id: "1998139849",
    closedStageIds: new Set(["3436662221", "3436662222"]),
    wonStageId: "3436662221",
  },
};

function parseAmount(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return Number(val) || 0;
  return 0;
}

function daysBetween(from: string, to: string): number {
  const diffMs = Math.abs(new Date(to).getTime() - new Date(from).getTime());
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function calculateMetrics(
  allDeals: HubSpotDeal[],
  config: (typeof PIPELINES)[keyof typeof PIPELINES]
): PipelineMetrics {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const deals = allDeals.filter((d) => d.properties.pipeline === config.id);

  let newLeads = 0;
  let activeDealCount = 0;
  let activeDealValue = 0;
  let wonDealsThisMonth = 0;
  const daysToCloseDurations: number[] = [];

  for (const deal of deals) {
    const props = deal.properties;
    const stageId = props.dealstage ?? "";
    const amount = parseAmount(props.amount);
    const isClosed = config.closedStageIds.has(stageId);

    if (props.createdate && new Date(props.createdate) >= thirtyDaysAgo) {
      newLeads++;
    }

    if (!isClosed) {
      activeDealCount++;
      activeDealValue += amount;
    }

    if (stageId === config.wonStageId && props.closedate) {
      const closeDate = new Date(props.closedate);
      if (closeDate >= monthStart && closeDate <= now) {
        wonDealsThisMonth++;
        if (props.createdate) {
          daysToCloseDurations.push(daysBetween(props.createdate, props.closedate));
        }
      }
    }
  }

  const avgDaysToClose =
    daysToCloseDurations.length > 0
      ? Math.round(daysToCloseDurations.reduce((a, b) => a + b, 0) / daysToCloseDurations.length)
      : 0;

  return { newLeads, activeDealCount, activeDealValue, wonDealsThisMonth, avgDaysToClose };
}

async function loadMetrics(): Promise<NextResponse<ResponseBody>> {
  try {
    const deals = await getHubSpotDeals();

    return NextResponse.json({
      focablyED: calculateMetrics(deals, PIPELINES.focablyED),
      siteMargin: calculateMetrics(deals, PIPELINES.siteMargin),
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

export async function GET(): Promise<NextResponse<ResponseBody>> {
  return loadMetrics();
}

// The dashboard's "Refresh" button POSTs here -- there was previously no
// handler for that at all (a plain 405), since HubSpot is fetched live on
// every call anyway and there's nothing to invalidate.
export async function POST(): Promise<NextResponse<ResponseBody>> {
  return loadMetrics();
}
