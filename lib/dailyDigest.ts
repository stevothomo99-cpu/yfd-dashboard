import { getTasksForStaff } from "./workflow";
import { aestTodayIso, getIndividualReportRecipients } from "./mondayReport";
import type { TaskWithDetails, WorkflowStaff } from "@/types/workflow";

// Daily 7am AEST digest -- a lighter, every-morning version of the Monday
// "Workflow Update" (lib/mondayReport.ts), just overdue + due-today, sent to
// every included staff member. Deliberately does NOT fire on Monday AEST
// (see vercel.json's cron, which only covers UTC Mon-Sat 21:00 = AEST
// Tue-Sun 07:00) -- Monday's own Workflow Update already covers overdue and
// due-today as part of its fuller weekly report, so a second email at the
// same moment would just be a duplicate. Reuses lib/mondayReport.ts's AEST
// wall-clock helper and recipient list rather than redefining them -- same
// roster, same "included staff" convention (§6.3).

export interface DailyDigestTaskLine {
  id: string;
  title: string;
  customerName: string;
  typeName: string | null;
  dueDate: string;
}

export interface DailyDigestData {
  staff: WorkflowStaff;
  todayIso: string;
  overdueCount: number;
  // Deliberately uncapped, same convention as the Monday Report's
  // "Overdue, by client" section (§6.4) -- the point is to see the whole
  // backlog, not a truncated "+N more".
  overdueTasks: DailyDigestTaskLine[];
  dueTodayCount: number;
  dueTodayTasks: DailyDigestTaskLine[];
}

function toLine(task: TaskWithDetails): DailyDigestTaskLine {
  return {
    id: task.id,
    title: task.title,
    customerName: task.customerName,
    typeName: task.typeName,
    dueDate: task.dueDate as string,
  };
}

// Pure computation, split from the Supabase-fetching wrapper below so it's
// testable against a fixed task list without a live board fetch.
export function computeDailyDigest(
  staff: WorkflowStaff,
  tasks: TaskWithDetails[],
  todayIso: string,
): DailyDigestData {
  const overdueTasks: DailyDigestTaskLine[] = [];
  const dueTodayTasks: DailyDigestTaskLine[] = [];

  for (const task of tasks) {
    if (task.statusIsComplete || !task.dueDate) continue;
    if (task.dueDate < todayIso) overdueTasks.push(toLine(task));
    else if (task.dueDate === todayIso) dueTodayTasks.push(toLine(task));
  }

  overdueTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  dueTodayTasks.sort((a, b) => a.customerName.localeCompare(b.customerName));

  return {
    staff,
    todayIso,
    overdueCount: overdueTasks.length,
    overdueTasks,
    dueTodayCount: dueTodayTasks.length,
    dueTodayTasks,
  };
}

// Fetches staff's own board (owned + temporarily reassigned, same set My
// Work shows) and builds their digest -- the route's entry point.
export async function buildDailyDigestData(
  staff: WorkflowStaff,
  todayIso: string = aestTodayIso(),
): Promise<DailyDigestData> {
  const tasks = await getTasksForStaff(staff.id);
  return computeDailyDigest(staff, tasks, todayIso);
}

// Same recipients as the Monday Report's individual send -- every included
// staff member with an email set (§6.3).
export async function getDailyDigestRecipients(): Promise<WorkflowStaff[]> {
  return getIndividualReportRecipients();
}
