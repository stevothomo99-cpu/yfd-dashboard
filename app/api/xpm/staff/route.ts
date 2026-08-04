import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getXpmStaff, isXpmConfigured, XpmNotConfiguredError } from "@/lib/xpm";
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

function applyExclusions(staff: XpmStaff[], excludedStaffIds: string[]): XpmStaff[] {
  return staff.map((s) => ({ ...s, included: !excludedStaffIds.includes(s.id) }));
}

const mockStaff = (excludedStaffIds: string[]): XpmStaff[] =>
  applyExclusions(
    STAFF.map((s) => ({
      id: s.id,
      name: s.name,
      email: `${s.id}@yfd.example`,
      role: "Manager" as const,
      included: true,
    })),
    excludedStaffIds,
  );

async function handle(forceRefresh: boolean): Promise<NextResponse<ResponseBody>> {
  const settings = await getSettings();

  if (!isXpmConfigured()) {
    return NextResponse.json({
      mode: "mock",
      partnerName: settings.partnerName,
      staff: mockStaff(settings.excludedStaffIds),
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
    const staff = await getXpmStaff(settings.partnerName, { forceRefresh });
    return NextResponse.json({
      mode: "live",
      partnerName: settings.partnerName,
      staff: applyExclusions(staff, settings.excludedStaffIds),
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof XpmNotConfiguredError) {
      return NextResponse.json({
        mode: "mock",
        partnerName: settings.partnerName,
        staff: mockStaff(settings.excludedStaffIds),
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

// Admin-only: exposes the XPM staff roster and (via POST) forces a refresh
// against XPM, spending rate-limit budget. Only the admin-gated Settings page
// calls it. Nav-gating alone left it reachable by any signed-in user.
async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  return handle(false);
}

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  return handle(true);
}
