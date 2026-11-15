import { NextResponse } from "next/server";
import { getKarbonUsers, isKarbonConfigured, KarbonNotConfiguredError } from "@/lib/karbon";
import { getSettings } from "@/lib/settings";
import { KARBON_USERS } from "@/lib/mock";
import { requireSession } from "@/lib/routeAuth";
import type { KarbonUser } from "@/types/karbon";

interface ResponseBody {
  mode: "live" | "mock";
  users: KarbonUser[];
  syncedAt: string;
  message?: string;
}

async function handle(forceRefresh: boolean): Promise<NextResponse<ResponseBody>> {
  const settings = await getSettings();
  const excluded = settings.excludedStaffIds;

  if (!isKarbonConfigured()) {
    return NextResponse.json({
      mode: "mock",
      users: KARBON_USERS.filter((u) => !excluded.includes(u.id)),
      syncedAt: new Date().toISOString(),
      message: "Returned mock data because KARBON_API_KEY is not set.",
    });
  }

  try {
    const users = await getKarbonUsers(excluded, { forceRefresh });
    return NextResponse.json({ mode: "live", users, syncedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof KarbonNotConfiguredError) {
      return NextResponse.json({
        mode: "mock",
        users: KARBON_USERS.filter((u) => !excluded.includes(u.id)),
        syncedAt: new Date().toISOString(),
        message: err.message,
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { mode: "live", users: [], syncedAt: new Date().toISOString(), message },
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
