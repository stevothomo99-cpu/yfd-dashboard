import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSettings, updateSettings } from "@/lib/settings";

// Both verbs are admin-only. Settings is nav-gated to admins, but nav is not
// a wall: these were reachable by any signed-in user, and PATCH sets the
// practice-wide Partner filter -- the single value that scopes which clients,
// jobs and staff the whole dashboard can see. GET is gated too since it
// discloses that filter and the staff exclusion list.
//
// Only the (admin-only) Settings page calls either, so nothing else breaks.
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

  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => ({}));
  const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  const patch: {
    partnerName?: string;
    excludedStaffIds?: string[];
    showPartnersInTimesheets?: boolean;
  } = {};
  if (typeof input.partnerName === "string") {
    patch.partnerName = input.partnerName.trim();
  }
  if (
    Array.isArray(input.excludedStaffIds) &&
    input.excludedStaffIds.every((id): id is string => typeof id === "string")
  ) {
    patch.excludedStaffIds = input.excludedStaffIds;
  }
  if (typeof input.showPartnersInTimesheets === "boolean") {
    patch.showPartnersInTimesheets = input.showPartnersInTimesheets;
  }

  const settings = await updateSettings(patch);
  return NextResponse.json(settings);
}
