import type { StaffRole, TaskWithDetails, WorkflowStaff } from "@/types/workflow";
import { BAS_TYPE_NAME } from "./workOverview";
import type { WagesUtilisationResult } from "./workOverview";

export interface StaffStats {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  tasksDone: number;
  tasksOverdue: number;
  totalTasks: number;
  taskCompletionRate: number;
  // Only completed BAS/IAS tasks are judgeable as on-time or late -- an open
  // one is just not-yet-due or overdue, which the Overdue tile already
  // covers. null when this person has no completed BAS/IAS work to judge.
  basCompletedTotal: number;
  basOnTime: number;
  basOnTimeRate: number | null;
  // Against available capacity (standard hours minus leave) -- the
  // "performance-manage on" figure from lib/workOverview.ts, not the
  // share-of-logged one XPM's own report calls %. null if this person isn't
  // linked to an XPM staff record or has no timesheet data for the period.
  billableCapacityPct: number | null;
  score: number;
}

// CONTEXT.md's composite score: 50% billable-hours (against capacity), 30%
// task completion rate, 20% BAS on-time rate. Previously only the latter two
// were computable from Karbon alone (re-weighted 60/40); billable data is
// now available via lib/workOverview.ts's computeWagesUtilisation and a real
// completion timestamp exists (tasks.completed_at, migration 024), so this
// is finally the actual formula rather than a partial one -- see
// CONTEXT.md §0/§6.6.
const WEIGHT_BILLABLE = 0.5;
const WEIGHT_TASKS = 0.3;
const WEIGHT_BAS = 0.2;

// A component with no data for a given staff member (no XPM link for
// billable, no tasks assigned at all, no completed BAS/IAS work to judge
// on-time-ness) drops out of the average and the remaining weights are
// renormalised, rather than scoring the missing component as a hard zero --
// the same shape the old partial score used when billable was entirely
// unavailable (30/20 renormalised to 60/40).
export function computeStaffStats(
  staff: WorkflowStaff[],
  tasksByStaffId: Map<string, TaskWithDetails[]>,
  utilisationByXpmStaffId: Map<string, WagesUtilisationResult>,
): StaffStats[] {
  return staff.map((s) => {
    const tasks = tasksByStaffId.get(s.id) ?? [];
    const totalTasks = tasks.length;
    const tasksDone = tasks.filter((t) => t.statusIsComplete).length;
    const tasksOverdue = tasks.filter((t) => t.isOverdue).length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0;

    const completedBas = tasks.filter(
      (t) => t.typeName === BAS_TYPE_NAME && t.statusIsComplete && t.completedAt && t.dueDate,
    );
    const basOnTime = completedBas.filter((t) => t.completedAt!.slice(0, 10) <= t.dueDate!).length;
    const basOnTimeRate = completedBas.length > 0 ? Math.round((basOnTime / completedBas.length) * 100) : null;

    const billableCapacityPct = s.xpmStaffId
      ? utilisationByXpmStaffId.get(s.xpmStaffId)?.billableCapacityPct ?? null
      : null;

    const components: { weight: number; value: number }[] = [];
    if (billableCapacityPct !== null) components.push({ weight: WEIGHT_BILLABLE, value: billableCapacityPct });
    if (totalTasks > 0) components.push({ weight: WEIGHT_TASKS, value: taskCompletionRate });
    if (basOnTimeRate !== null) components.push({ weight: WEIGHT_BAS, value: basOnTimeRate });

    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    const score =
      totalWeight > 0
        ? Math.round(components.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight)
        : 0;

    return {
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      tasksDone,
      tasksOverdue,
      totalTasks,
      taskCompletionRate,
      basCompletedTotal: completedBas.length,
      basOnTime,
      basOnTimeRate,
      billableCapacityPct,
      score,
    } satisfies StaffStats;
  });
}
