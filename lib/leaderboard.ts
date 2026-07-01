import type { KarbonTask, KarbonUser, KarbonWorkItem } from "@/types/karbon";

export interface StaffStats {
  id: string;
  name: string;
  email: string;
  tasksDone: number;
  tasksOverdue: number;
  totalTasks: number;
  taskCompletionRate: number;
  basTotal: number;
  basOverdue: number;
  basOnTimeRate: number;
  partialScore: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// CONTEXT.md's composite score is 50% billable-hours ratio (needs XPM
// timesheets — not available), 30% task completion rate, 20% BAS on-time
// rate (both fully computable from Karbon alone). This computes only the
// latter two, re-weighted 60/40 to preserve their 3:2 ratio without the
// billable component — a partial, directional score, not the final formula.
// BAS "on time" is approximated as "not currently overdue" (no lodged-date
// field is available to check against the due date after the fact).
export function computeStaffStats(
  users: KarbonUser[],
  tasks: KarbonTask[],
  basWorkItems: KarbonWorkItem[],
): StaffStats[] {
  const today = todayIso();

  return users.map((u) => {
    const userTasks = tasks.filter((t) => t.assigneeId === u.id);
    const tasksDone = userTasks.filter((t) => t.status === "complete").length;
    const tasksOverdue = userTasks.filter((t) => t.isOverdue).length;
    const totalTasks = userTasks.length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0;

    const userBas = basWorkItems.filter((w) => w.assigneeId === u.id);
    const basOverdue = userBas.filter(
      (w) => w.status !== "complete" && w.dueDate !== "" && w.dueDate < today,
    ).length;
    const basTotal = userBas.length;
    const basOnTimeRate = basTotal > 0 ? Math.round(((basTotal - basOverdue) / basTotal) * 100) : 0;

    const hasData = totalTasks > 0 || basTotal > 0;
    const partialScore = hasData ? Math.round(taskCompletionRate * 0.6 + basOnTimeRate * 0.4) : 0;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      tasksDone,
      tasksOverdue,
      totalTasks,
      taskCompletionRate,
      basTotal,
      basOverdue,
      basOnTimeRate,
      partialScore,
    } satisfies StaffStats;
  });
}
