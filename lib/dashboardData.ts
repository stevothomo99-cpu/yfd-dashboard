import {
  getKarbonTasks,
  getKarbonWorkItems,
  getKarbonUsers,
  isKarbonConfigured,
  KarbonNotConfiguredError,
} from "./karbon";
import { computeStaffStats, type StaffStats } from "./leaderboard";
import { TASKS, WORK_ITEMS, KARBON_USERS } from "./mock";
import type { KarbonTask, KarbonWorkItem, KarbonUser } from "@/types/karbon";

export interface DashboardKarbonData {
  mode: "live" | "mock";
  users: KarbonUser[];
  tasks: KarbonTask[];
  basWorkItems: KarbonWorkItem[];
  stats: StaffStats[];
  message?: string;
}

function mockData(excludedStaffIds: string[], message?: string): DashboardKarbonData {
  const users = KARBON_USERS.filter((u) => !excludedStaffIds.includes(u.id));
  const tasks = TASKS.filter((t) => !excludedStaffIds.includes(t.assigneeId));
  const basWorkItems = WORK_ITEMS.filter((w) => !excludedStaffIds.includes(w.assigneeId));
  return {
    mode: "mock",
    users,
    tasks,
    basWorkItems,
    stats: computeStaffStats(users, tasks, basWorkItems),
    message,
  };
}

// Shared by the Overview and Leaderboard Server Components, which both need
// the same (users, tasks, BAS work items) triple to compute StaffStats.
export async function loadDashboardKarbonData(
  excludedStaffIds: string[],
): Promise<DashboardKarbonData> {
  if (!isKarbonConfigured()) {
    return mockData(excludedStaffIds, "Showing mock data because KARBON_API_KEY is not set.");
  }

  try {
    const [users, tasks, basWorkItems] = await Promise.all([
      getKarbonUsers(excludedStaffIds),
      getKarbonTasks(excludedStaffIds),
      getKarbonWorkItems(excludedStaffIds),
    ]);
    return {
      mode: "live",
      users,
      tasks,
      basWorkItems,
      stats: computeStaffStats(users, tasks, basWorkItems),
    };
  } catch (err) {
    if (err instanceof KarbonNotConfiguredError) {
      return mockData(excludedStaffIds, err.message);
    }
    return {
      mode: "live",
      users: [],
      tasks: [],
      basWorkItems: [],
      stats: [],
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
