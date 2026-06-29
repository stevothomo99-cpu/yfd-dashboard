import { NextResponse } from "next/server";
import {
  bustXpmStaffCache,
  getXpmStaff,
  isXpmConfigured,
  XpmNotConfiguredError,
} from "@/lib/xpm";
import { getSettings } from "@/lib/settings";
import { STAFF } from "@/lib/mock";
import type { XpmStaff } from "@/types/xpm";

interface ResponseBody {
  mode: "live" | "mock";
  partnerName: string;
  staff: XpmStaff[];
  syncedAt: string;
  message?: string;
}

const mockStaff = (): XpmStaff[] =>
  STAFF.map((s) => ({
    id: s.id,
    name: s.name,
    email: `${s.id}@yfd.example`,
    role: "Manager" as const,
    included: s.included,
  }));

async function handle(forceRefresh: boolean): Promise<NextResponse<ResponseBody>> {
  const settings = await getSettings();

  if (!isXpmConfigured()) {
    return NextResponse.json({
      mode: "mock",
      partnerName: settings.partnerName,
      staff: mockStaff(),
      syncedAt: new Date().toISOString(),
      message:
        "Returned mock data because XPM_CLIENT_ID, XPM_CLIENT_SECRET, XPM_REFRESH_TOKEN, or XPM_TENANT_ID are not set.",
    });
  }

  if (!settings.partnerName) {
    return NextResponse.json({
      mode: "live",
      partnerName: "",
      staff: [],
      syncedAt: new Date().toISOString(),
      message: "No Partner name configured in Settings — set it and re-sync.",
    });
  }

  try {
    if (forceRefresh) await bustXpmStaffCache(settings.partnerName);
    const staff = await getXpmStaff(settings.partnerName, { forceRefresh });
    return NextResponse.json({
      mode: "live",
      partnerName: settings.partnerName,
      staff,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof XpmNotConfiguredError) {
      return NextResponse.json({
        mode: "mock",
        partnerName: settings.partnerName,
        staff: mockStaff(),
        syncedAt: new Date().toISOString(),
        message: err.message,
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        mode: "live",
        partnerName: settings.partnerName,
        staff: [],
        syncedAt: new Date().toISOString(),
        message,
      },
      { status: 502 },
    );
  }
}

export async function GET() {
  return handle(false);
}

export async function POST() {
  return handle(true);
}
