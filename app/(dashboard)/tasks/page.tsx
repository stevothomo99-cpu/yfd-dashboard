import TasksPageClient from "./TasksPageClient";
import {
  getKarbonTasks,
  isKarbonConfigured,
  KarbonNotConfiguredError,
  loadKarbonUsersSnapshot,
} from "@/lib/karbon";
import { getSettings } from "@/lib/settings";
import { TASKS, KARBON_USERS } from "@/lib/mock";
import type { KarbonTask } from "@/types/karbon";

export interface TasksSnapshot {
  mode: "live" | "mock";
  tasks: KarbonTask[];
  syncedAt: string;
  message?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadSnapshot(): Promise<TasksSnapshot> {
  const settings = await getSettings();
  const excluded = settings.excludedStaffIds;

  if (!isKarbonConfigured()) {
    return {
      mode: "mock",
      tasks: TASKS.filter((t) => !excluded.includes(t.assigneeId)),
      syncedAt: new Date().toISOString(),
      message: "Showing mock data because KARBON_API_KEY is not set.",
    };
  }

  try {
    const tasks = await getKarbonTasks(excluded);
    return { mode: "live", tasks, syncedAt: new Date().toISOString() };
  } catch (err) {
    if (err instanceof KarbonNotConfiguredError) {
      return {
        mode: "mock",
        tasks: TASKS.filter((t) => !excluded.includes(t.assigneeId)),
        syncedAt: new Date().toISOString(),
        message: err.message,
      };
    }
    return {
      mode: "live",
      tasks: [],
      syncedAt: new Date().toISOString(),
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export default async function TasksPage() {
  const settings = await getSettings();
  const [snapshot, staff] = await Promise.all([
    loadSnapshot(),
    loadKarbonUsersSnapshot(settings.excludedStaffIds, KARBON_USERS),
  ]);
  const today = todayIso();
  const weekEnd = addDays(today, 7);
  return (
    <TasksPageClient initial={snapshot} staff={staff.users} today={today} weekEnd={weekEnd} />
  );
}
