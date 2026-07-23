import type { TaskWithDetails } from "@/types/workflow";
import type { XpmTimesheet } from "@/types/xpm";
import { fyYearFor, fyRange } from "./utils";

// Pure computation helpers for the /dashboard "Work overview" tiles --
// kept separate from lib/workflow.ts (Supabase-backed) and lib/xpm.ts
// (XPM API client) since these just shape data those two already fetch.

// BAS/IAS is one of the seeded task_types (see migrations/004) -- matched
// by name since there's no dedicated "is this a BAS task" flag. Exported
// so lib/workflow.ts's getClientSummaries can flag overdue BAS work per
// client without duplicating the string.
export const BAS_TYPE_NAME = "BAS/IAS";

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

// Wages/timesheet utilisation -- confirmed directly with the practice:
// each staff member has a 38hr standard week. Time coded to any client is
// billable; time coded to the single internal "YFD Internal" job is idle
// UNLESS it's coded to that job's "YFD - Leave" task specifically, which
// counts as accounted-for time same as client work. Whatever's left to
// reach the 38hr/week standard for the period is implicitly non-billable
// too, because the denominator is always the full standard (38 * weekdays
// in the period, per staff member), not the sum of what was actually
// logged -- so billable% = (clientHours + leaveHours) / standardHours,
// naturally reading low if a staff member hasn't logged enough to cover
// the standard week. Periods always use their FULL target, never prorated
// to elapsed days, even mid-week/mid-month/mid-FY (confirmed decision).
export const INTERNAL_CLIENT_XPM_ID = "c4a69e58-19b6-4f69-be97-43fa007f6f06"; // Your Finance Department Pty Ltd
const LEAVE_TASK_NAME = "YFD - Leave";
const STANDARD_HOURS_PER_DAY = 7.6; // 38hr/week over a 5-day week

export type UtilisationPeriodKey = "week" | "month" | "quarter" | "fy";

export const UTILISATION_PERIODS: { value: UtilisationPeriodKey; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "fy", label: "This FY" },
];

function startOfWeekMonday(d: Date): Date {
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(d);
  start.setUTCDate(start.getUTCDate() - diff);
  return start;
}

// Quarters here are the four fixed calendar quarters (ending 31 Mar / 30
// Jun / 30 Sep / 31 Dec), not FY-numbered quarters -- confirmed directly.
// Exported so callers outside this file (e.g. the Clients page's Xero
// Accounting revenue fetch) can compute the same date range a period button
// means here, without re-deriving FY/quarter/week logic themselves.
export function periodBounds(period: UtilisationPeriodKey, today: Date): { start: Date; end: Date } {
  switch (period) {
    case "week": {
      const start = startOfWeekMonday(today);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      return { start, end };
    }
    case "month": {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
      return { start, end };
    }
    case "quarter": {
      const q = Math.floor(today.getUTCMonth() / 3);
      const start = new Date(Date.UTC(today.getUTCFullYear(), q * 3, 1));
      const end = new Date(Date.UTC(today.getUTCFullYear(), q * 3 + 3, 0));
      return { start, end };
    }
    case "fy":
      return fyRange(fyYearFor(today));
  }
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d.getTime() <= end.getTime()) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

export interface WagesUtilisationResult {
  period: UtilisationPeriodKey;
  clientHours: number;
  leaveHours: number;
  idleHours: number;
  standardHours: number;
  pct: number;
}

// staffIds determines both whose hours count AND how many people's 38hr
// week the standard-hours denominator expects -- pass every staff id for a
// practice-wide view, or a single id to scope to one person.
export function computeWagesUtilisation(
  timesheets: XpmTimesheet[],
  staffIds: string[],
  period: UtilisationPeriodKey,
  todayIso: string,
): WagesUtilisationResult {
  const today = new Date(todayIso + "T00:00:00Z");
  const { start, end } = periodBounds(period, today);
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
  const staffIdSet = new Set(staffIds);

  let clientHours = 0;
  let leaveHours = 0;
  let idleHours = 0;
  for (const t of timesheets) {
    if (!staffIdSet.has(t.staffId) || t.date < startIso || t.date > endIso) continue;
    if (t.clientId !== INTERNAL_CLIENT_XPM_ID) clientHours += t.hours;
    else if (t.taskName === LEAVE_TASK_NAME) leaveHours += t.hours;
    else idleHours += t.hours;
  }

  const standardHours = countWeekdays(start, end) * STANDARD_HOURS_PER_DAY * staffIds.length;
  const accounted = clientHours + leaveHours;

  return {
    period,
    clientHours,
    leaveHours,
    idleHours,
    standardHours,
    pct: standardHours > 0 ? Math.round((accounted / standardHours) * 100) : 0,
  };
}

export interface ClientHoursBreakdown {
  clientId: string;
  clientName: string;
  hours: number;
}

// Time-by-client breakdown for the selected range -- internal/leave/idle
// time is excluded since it isn't attributable to any client.
export function computeHoursByClient(
  timesheets: XpmTimesheet[],
  staffIds: string[],
  period: UtilisationPeriodKey,
  todayIso: string,
  clientNamesById: Map<string, string>,
): ClientHoursBreakdown[] {
  const today = new Date(todayIso + "T00:00:00Z");
  const { start, end } = periodBounds(period, today);
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
  const staffIdSet = new Set(staffIds);

  const totals = new Map<string, number>();
  for (const t of timesheets) {
    if (!staffIdSet.has(t.staffId) || t.date < startIso || t.date > endIso) continue;
    if (t.clientId === INTERNAL_CLIENT_XPM_ID) continue;
    totals.set(t.clientId, (totals.get(t.clientId) ?? 0) + t.hours);
  }

  return Array.from(totals.entries())
    .map(([clientId, hours]) => ({
      clientId,
      clientName: clientNamesById.get(clientId) ?? "Unknown client",
      hours,
    }))
    .sort((a, b) => b.hours - a.hours);
}
