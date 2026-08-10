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

// The BAS/IAS task_types row's id in the live yfd-workflow Supabase project
// -- confirmed directly against task_types. Used (unlike BAS_TYPE_NAME
// above) where an exact type_id match is needed rather than a display-name
// match, e.g. /api/workflow/tasks/[id]/bas-stage gating which tasks may go
// through the approval pipeline.
export const BAS_TASK_TYPE_ID = "4267f72b-9f4a-4d61-93b9-74e5713b718b";

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

// Wages/timesheet utilisation -- confirmed directly with the practice: each
// staff member has a 38hr standard week (7.6hr weekday).
//
// Time coded to any client is billable. Time coded to the single internal
// "YFD Internal" job splits four ways by task name -- leave, idle, and
// everything else (general admin, paid team meetings), the last of which is
// paid time nobody can be marked down for.
//
// There are three percentages here and they answer different questions, so
// the right one depends on what's being asked. Against identical data for
// 6 Jul - 2 Aug 2026 they read 77%, 81% and 65%:
//
//   pct (capacity used)   accounted / standard. Is the team's time accounted
//                         for at all? Falls when people under-log.
//   billableSharePct      client / logged. XPM's own % column. Blind to
//                         hours nobody entered, so it flatters anyone who
//                         logs little but logs it all to clients.
//   billableCapacityPct   client / (standard - leave). Treats unlogged time
//                         as non-billable, which is what it is until proven
//                         otherwise. The one to performance-manage on.
//
// Capacity is counted to today, never to the end of an unfinished period --
// see the note on capacityEnd below.
export const INTERNAL_CLIENT_XPM_ID = "c4a69e58-19b6-4f69-be97-43fa007f6f06"; // Your Finance Department Pty Ltd
const LEAVE_TASK_NAME = "YFD - Leave";
// Only genuinely idle time is excluded from utilisation. Matched on the task
// name containing "idle" rather than an exact string, so an "Idle" variant or
// a renamed FY job doesn't silently start counting as productive.
function isIdleTask(taskName: string | null): boolean {
  return Boolean(taskName && /idle/i.test(taskName));
}
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

// An explicit, inclusive date range -- the alternative to one of the fixed
// week/month/quarter/fy buttons, so Timesheets can offer a custom From/To.
export interface DateRange {
  start: string; // ISO yyyy-mm-dd, inclusive
  end: string; // ISO yyyy-mm-dd, inclusive
}

// Either a named period or an explicit range. Accepted everywhere a period
// key used to be, so existing callers are unaffected.
export type PeriodSelection = UtilisationPeriodKey | DateRange;

function resolveSelection(selection: PeriodSelection, today: Date): { start: Date; end: Date } {
  if (typeof selection === "string") return periodBounds(selection, today);
  return {
    start: new Date(selection.start + "T00:00:00Z"),
    end: new Date(selection.end + "T00:00:00Z"),
  };
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
  // Paid internal time that is neither client work, leave, nor idle --
  // general admin, paid team meetings. Counts toward utilisation.
  internalOtherHours: number;
  // The range actually measured, inclusive. Replaces the old period key: a
  // custom range has no key, and callers want to display the dates anyway.
  range: DateRange;
  clientHours: number;
  leaveHours: number;
  idleHours: number;
  standardHours: number;
  // Everything actually entered in XPM for the range -- the sum of the four
  // buckets above. The one number that reconciles this result against XPM's
  // own Staff Time Summary Report.
  loggedHours: number;
  // standardHours - loggedHours. Positive means time that was never entered
  // at all; negative means more was logged than the standard week allows
  // for. Signed on purpose -- clamping it to zero hides genuine overtime.
  unloggedHours: number;
  pct: number;
  // Billable as a share of time actually logged. This is the figure XPM's
  // report calls %, and it says nothing about hours nobody entered.
  billableSharePct: number | null;
  // Billable against available capacity, which treats unlogged time as
  // non-billable -- the honest version of the number above, and the one
  // that moves when someone under-logs.
  billableCapacityPct: number | null;
}

// staffIds determines both whose hours count AND how many people's 38hr
// week the standard-hours denominator expects -- pass every staff id for a
// practice-wide view, or a single id to scope to one person.
export function computeWagesUtilisation(
  timesheets: XpmTimesheet[],
  staffIds: string[],
  selection: PeriodSelection,
  todayIso: string,
): WagesUtilisationResult {
  const today = new Date(todayIso + "T00:00:00Z");
  const { start, end } = resolveSelection(selection, today);
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
  const staffIdSet = new Set(staffIds);

  // Utilisation is everything except idle time, against a 7.6hr day.
  //
  // The internal client's time is not one undifferentiated lump: alongside
  // "YFD - Idle" it carries "YFD - General Admin", "YFD - Team Meeting -
  // Paid" and leave, all of which are paid time a person cannot be marked
  // down for. Bucketing everything internal-and-not-leave as idle wrote off
  // 54 of 71 internal hours in Jul-Aug 2026 and understated the practice by
  // 12 points (65% where 77% was right).
  let clientHours = 0;
  let leaveHours = 0;
  let internalOtherHours = 0;
  let idleHours = 0;
  for (const t of timesheets) {
    if (!staffIdSet.has(t.staffId) || t.date < startIso || t.date > endIso) continue;
    if (t.clientId !== INTERNAL_CLIENT_XPM_ID) clientHours += t.hours;
    else if (isIdleTask(t.taskName)) idleHours += t.hours;
    else if (t.taskName === LEAVE_TASK_NAME) leaveHours += t.hours;
    else internalOtherHours += t.hours;
  }

  // Capacity is counted only up to today, never to the end of the period.
  // The hours above are whatever has actually been logged so far, so
  // measuring them against the *whole* period's capacity compares
  // to-date effort with a not-yet-elapsed denominator: on 27 Jul the FY
  // tile divided ~4 weeks of work by a full year (261 weekdays x 7.6 x 4
  // staff = 7934.4 std hrs) and reported 2% instead of 34%. Same
  // understatement mid-month, mid-quarter and mid-week.
  const capacityEnd = end.getTime() > today.getTime() ? today : end;
  const standardHours = countWeekdays(start, capacityEnd) * STANDARD_HOURS_PER_DAY * staffIds.length;
  const accounted = clientHours + leaveHours + internalOtherHours;

  // Every percentage the page shows is derived here, not at the call site.
  // Two of them used to be computed in TimesheetsPageClient -- the tile and
  // the per-employee row each summed their own denominator, drifted apart
  // when internalOtherHours was added as a bucket, and the tile spent a
  // while reporting 95% where the same data gave 81%.
  const loggedHours = clientHours + leaveHours + internalOtherHours + idleHours;

  // Leave comes out of the capacity denominator rather than counting as
  // unbillable time. Approved leave isn't available capacity, so charging it
  // against someone's billable percentage would mark them down for taking
  // it -- a fortnight off would read as a fortnight of nothing billed.
  const billableCapacity = Math.max(0, standardHours - leaveHours);

  return {
    range: { start: startIso, end: endIso },
    clientHours,
    leaveHours,
    internalOtherHours,
    idleHours,
    standardHours,
    loggedHours,
    unloggedHours: standardHours - loggedHours,
    pct: standardHours > 0 ? Math.round((accounted / standardHours) * 100) : 0,
    billableSharePct: loggedHours > 0 ? Math.round((clientHours / loggedHours) * 100) : null,
    billableCapacityPct:
      billableCapacity > 0 ? Math.round((clientHours / billableCapacity) * 100) : null,
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
  selection: PeriodSelection,
  todayIso: string,
  clientNamesById: Map<string, string>,
): ClientHoursBreakdown[] {
  const today = new Date(todayIso + "T00:00:00Z");
  const { start, end } = resolveSelection(selection, today);
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

// Practice-wide billable hours (all clients summed, internal time
// excluded) over an arbitrary explicit date range rather than one of the
// fixed week/month/quarter/fy buttons -- feeds the Business KPIs page's
// hours/$-per-hour figures, which need to line up with the Sales tile's
// calendar Month/YTD windows (not the FY-based periods used elsewhere).
export function computeTotalClientHoursInRange(
  timesheets: XpmTimesheet[],
  staffIds: string[],
  fromIso: string,
  toIso: string,
): number {
  const staffIdSet = new Set(staffIds);
  let total = 0;
  for (const t of timesheets) {
    if (!staffIdSet.has(t.staffId) || t.date < fromIso || t.date > toIso) continue;
    if (t.clientId === INTERNAL_CLIENT_XPM_ID) continue;
    total += t.hours;
  }
  return total;
}
