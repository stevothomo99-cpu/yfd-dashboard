import { NextResponse } from "next/server";
import { getXpmTimesheets, isXpmConfigured, XpmNotConfiguredError } from "@/lib/xpm";
import { getSettings } from "@/lib/settings";
import { TIMESHEETS } from "@/lib/mock";
import { requireSession } from "@/lib/routeAuth";
import type { XpmTimesheet } from "@/types/xpm";

// Same reasoning as the workflow sync: a cold timesheet fetch is the
// job-list windows plus one time.api call per staff member, throttled.
export const maxDuration = 300;

interface ResponseBody {
  mode: "live" | "mock";
  timesheets: XpmTimesheet[];
  syncedAt: string;
  message?: string;
}

async function handle(forceRefresh: boolean): Promise<NextResponse<ResponseBody>> {
  const settings = await getSettings();

  if (!isXpmConfigured()) {
    return NextResponse.json({
      mode: "mock",
      timesheets: TIMESHEETS,
      syncedAt: new Date().toISOString(),
      message:
        "Returned mock data because XPM_CLIENT_ID, XPM_CLIENT_SECRET, XPM_REFRESH_TOKEN, or XPM_TENANT_ID are not set.",
    });
  }

  if (!settings.partnerName) {
    return NextResponse.json({
      mode: "live",
      timesheets: [],
      syncedAt: new Date().toISOString(),
      message: "No Partner name configured in Settings — set it and re-sync.",
    });
  }

  try {
    const timesheets = await getXpmTimesheets(settings.partnerName, { forceRefresh });
    return NextResponse.json({ mode: "live", timesheets, syncedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof XpmNotConfiguredError) {
      return NextResponse.json({
        mode: "mock",
        timesheets: TIMESHEETS,
        syncedAt: new Date().toISOString(),
        message: err.message,
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { mode: "live", timesheets: [], syncedAt: new Date().toISOString(), message },
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
