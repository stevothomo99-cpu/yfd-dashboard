import { NextResponse } from "next/server";
import {
  getKarbonWorkItems,
  isKarbonConfigured,
  KarbonNotConfiguredError,
} from "@/lib/karbon";
import { getSettings } from "@/lib/settings";
import { WORK_ITEMS } from "@/lib/mock";
import { requireSession } from "@/lib/routeAuth";
import type { KarbonWorkItem } from "@/types/karbon";

interface ResponseBody {
  mode: "live" | "mock";
  workItems: KarbonWorkItem[];
  syncedAt: string;
  basWorkTypeFilter: string | null;
  message?: string;
}

async function handle(forceRefresh: boolean): Promise<NextResponse<ResponseBody>> {
  const settings = await getSettings();
  const excluded = settings.excludedStaffIds;
  const basWorkTypeFilter = process.env.KARBON_BAS_WORK_TYPE ?? null;

  if (!isKarbonConfigured()) {
    return NextResponse.json({
      mode: "mock",
      workItems: WORK_ITEMS.filter((w) => !excluded.includes(w.assigneeId)),
      syncedAt: new Date().toISOString(),
      basWorkTypeFilter,
      message: "Returned mock data because KARBON_API_KEY is not set.",
    });
  }

  try {
    const workItems = await getKarbonWorkItems(excluded, { forceRefresh });
    return NextResponse.json({
      mode: "live",
      workItems,
      syncedAt: new Date().toISOString(),
      basWorkTypeFilter,
    });
  } catch (err) {
    if (err instanceof KarbonNotConfiguredError) {
      return NextResponse.json({
        mode: "mock",
        workItems: WORK_ITEMS.filter((w) => !excluded.includes(w.assigneeId)),
        syncedAt: new Date().toISOString(),
        basWorkTypeFilter,
        message: err.message,
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { mode: "live", workItems: [], syncedAt: new Date().toISOString(), basWorkTypeFilter, message },
      { status: 502 },
    );
  }
}

// Was previously reachable by anyone, logged in or not.
export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  return handle(false);
}

export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  return handle(true);
}
