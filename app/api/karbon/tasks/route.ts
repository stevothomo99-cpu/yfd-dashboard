import { NextResponse } from "next/server";
import { getKarbonTasks, isKarbonConfigured, KarbonNotConfiguredError } from "@/lib/karbon";
import { getSettings } from "@/lib/settings";
import { TASKS } from "@/lib/mock";
import type { KarbonTask } from "@/types/karbon";

interface ResponseBody {
  mode: "live" | "mock";
  tasks: KarbonTask[];
  syncedAt: string;
  message?: string;
}

async function handle(forceRefresh: boolean): Promise<NextResponse<ResponseBody>> {
  const settings = await getSettings();
  const excluded = settings.excludedStaffIds;

  if (!isKarbonConfigured()) {
    return NextResponse.json({
      mode: "mock",
      tasks: TASKS.filter((t) => !excluded.includes(t.assigneeId)),
      syncedAt: new Date().toISOString(),
      message: "Returned mock data because KARBON_API_KEY is not set.",
    });
  }

  try {
    const tasks = await getKarbonTasks(excluded, { forceRefresh });
    return NextResponse.json({
      mode: "live",
      tasks,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof KarbonNotConfiguredError) {
      return NextResponse.json({
        mode: "mock",
        tasks: TASKS.filter((t) => !excluded.includes(t.assigneeId)),
        syncedAt: new Date().toISOString(),
        message: err.message,
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { mode: "live", tasks: [], syncedAt: new Date().toISOString(), message },
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
