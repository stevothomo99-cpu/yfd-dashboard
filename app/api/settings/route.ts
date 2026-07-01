import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  const patch: { partnerName?: string; excludedStaffIds?: string[] } = {};
  if (typeof input.partnerName === "string") {
    patch.partnerName = input.partnerName.trim();
  }
  if (
    Array.isArray(input.excludedStaffIds) &&
    input.excludedStaffIds.every((id): id is string => typeof id === "string")
  ) {
    patch.excludedStaffIds = input.excludedStaffIds;
  }

  const settings = await updateSettings(patch);
  return NextResponse.json(settings);
}
