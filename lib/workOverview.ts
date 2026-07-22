import type { TaskWithDetails } from "@/types/workflow";
import type { XpmTimesheet } from "@/types/xpm";

// Pure computation helpers for the /dashboard "Work overview" tiles --
// kept separate from lib/workflow.ts (Supabase-backed) and lib/xpm.ts
// (XPM API client) since these just shape data those two already fetch.

// BAS/IAS is one of the seeded task_types (see migrations/004) -- matched
// by name since there's no dedicated "is this a BAS task" flag.
const BAS_TYPE_NAME = "BAS/IAS";

// Returns the actual overdue tasks (not just a count) so the dashboard's
// Overdue tile can show a mini table, not just a number.
export function getOverdueTasks(board: TaskWithDetails[], today: string): TaskWithDetails[] {
  return board
    .filter((t) => !t.statusIsComplete && t.dueDate && t.dueDate < today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

// Open (non-complete) BAS/IAS tasks -- feeds the BAS Status tile's mini
// table. Overdue ones sort first.
export function getBasTasks(board: TaskWithDetails[], today: string): TaskWithDetails[] {
  return board
    .filter((t) => !t.statusIsComplete && t.typeName === BAS_TYPE_NAME)
    .sort((a, b) => {
      const aOverdue = a.dueDate && a.dueDate < today;
      const bOverdue = b.dueDate && b.dueDate < today;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    });
}

export interface UtilisationPeriod {
  billableHours: number;
  totalHours: number;
  pct: number;
}

export interface UtilisationSummary {
  week: UtilisationPeriod;
  month: UtilisationPeriod;
  ytd: UtilisationPeriod;
}

// Time logged against YFD's own internal practice-management client record
// is never billable revenue, regardless of what XPM's raw `billable` flag
// says on that entry -- matched by name (case-insensitive substring) since
// the exact client UUID isn't known without a live XPM connection to look
// it up.
const INTERNAL_CLIENT_NAME_PATTERN = /your finance/i;

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeUtilisation(
  timesheets: XpmTimesheet[],
  clientNamesById: Map<string, string>,
  xpmStaffId: string,
  today: string
): UtilisationSummary {
  const mine = timesheets.filter((t) => t.staffId === xpmStaffId);

  const isBillable = (t: XpmTimesheet): boolean => {
    const clientName = clientNamesById.get(t.clientId);
    if (clientName && INTERNAL_CLIENT_NAME_PATTERN.test(clientName)) return false;
    return t.billable;
  };

  const bucket = (startDate: string): UtilisationPeriod => {
    const inRange = mine.filter((t) => t.date >= startDate && t.date <= today);
    const billableHours = inRange.filter(isBillable).reduce((acc, t) => acc + t.hours, 0);
    const totalHours = inRange.reduce((acc, t) => acc + t.hours, 0);
    return {
      billableHours,
      totalHours,
      pct: totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0,
    };
  };

  return {
    week: bucket(addDays(today, -6)),
    month: bucket(today.slice(0, 7) + "-01"),
    ytd: bucket(today.slice(0, 4) + "-01-01"),
  };
}
