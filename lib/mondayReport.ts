import { getAllTasks, getTasksForStaff, listStaff } from "./workflow";
import { getSettings } from "./settings";
import { getXpmTimesheets, isXpmConfigured } from "./xpm";
import { computeWagesUtilisation, periodBounds, BAS_TYPE_NAME } from "./workOverview";
import { fyRange, fyYearFor } from "./utils";
import type { TaskWithDetails, WorkflowStaff } from "@/types/workflow";
import type { XpmTimesheet } from "@/types/xpm";

// Pure(ish) data computation for the weekly "Monday Report" email -- see
// lib/emailTemplates/mondayReport.ts for how this is rendered. Two separate
// cron entry points consume this, at two different times, per the
// practice's requested schedule (see Settings -> Email Schedule):
// app/api/reports/overdue-summary/route.ts (buildCombinedReportData, Sunday
// 20:00 AEST -- the firm-wide overdue report, to the Partner) and
// app/api/reports/monday-report/route.ts (buildStaffReportData, Monday
// 07:00 AEST -- each person's own "Workflow Update").
//
// Deliberately due-date driven throughout, unlike the My Work page's own
// "Overdue" tile (start-date based) -- this report is about deadlines, not
// about what work has started. Don't conflate the two conventions.

const PAYROLL_TYPE_NAME = "Payroll";

// Both crons run at fixed AEST times (see vercel.json), but a Vercel Cron
// function itself runs in UTC -- "today"/"this week" must be computed
// against Brisbane's wall clock, not the server's. QLD does not observe
// daylight saving, so this is a fixed +10h offset year-round (confirmed
// against the client names in this codebase, e.g. "IWC Caloundra" / "IWC
// Brisbane" -- a QLD-based practice).
const AEST_OFFSET_MS = 10 * 60 * 60 * 1000;

export function aestNow(): Date {
  return new Date(Date.now() + AEST_OFFSET_MS);
}

// yyyy-mm-dd for "today" in AEST, read off a UTC-shifted Date so the
// existing UTC-based date helpers (periodBounds/fyRange/getUTCDay etc.) see
// the right wall-clock day without needing their own timezone awareness.
export function aestTodayIso(): string {
  return aestNow().toISOString().slice(0, 10);
}

export interface ReportWindow {
  todayIso: string;
  weekStartIso: string; // Monday
  weekEndIso: string; // Sunday
  generatedAtIso: string; // full timestamp, for the masthead
}

export function buildReportWindow(todayIso: string = aestTodayIso()): ReportWindow {
  const today = new Date(todayIso + "T00:00:00Z");
  const { start, end } = periodBounds("week", today);
  return {
    todayIso,
    weekStartIso: start.toISOString().slice(0, 10),
    weekEndIso: end.toISOString().slice(0, 10),
    generatedAtIso: new Date().toISOString(),
  };
}

export interface TaskLine {
  id: string;
  title: string;
  customerName: string;
  typeName: string | null;
  dueDate: string; // always set -- every line here is filtered to tasks with a due date
}

export interface OverdueTaskLine extends TaskLine {
  daysOverdue: number;
}

export interface ClientOverdueGroup {
  customerName: string;
  count: number;
  oldestDueDate: string;
  tasks: OverdueTaskLine[];
}

// Hours logged vs. standard for the calendar week that just finished --
// null if XPM isn't configured, this staff member isn't linked to an XPM
// record, or the fetch fails, so the report can degrade gracefully instead
// of showing a wrong or stale number.
export interface PriorWeekTimesheet {
  loggedHours: number;
  standardHours: number;
}

export interface StaffReportData {
  staff: WorkflowStaff;
  window: ReportWindow;
  overdueCount: number;
  dueThisWeekCount: number;
  dueLaterCount: number;
  basDueCount: number;
  payrollDueCount: number;
  dueThisWeekTasks: TaskLine[];
  overdueByClient: ClientOverdueGroup[];
  priorWeekTimesheet: PriorWeekTimesheet | null;
}

function daysOverdue(dueDate: string, todayIso: string): number {
  const due = new Date(dueDate + "T00:00:00Z").getTime();
  const today = new Date(todayIso + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((today - due) / (24 * 60 * 60 * 1000)));
}

type Bucket = "overdue" | "dueThisWeek" | "dueLater" | null;

function classify(task: TaskWithDetails, window: ReportWindow): Bucket {
  if (task.statusIsComplete || !task.dueDate) return null;
  if (task.dueDate < window.todayIso) return "overdue";
  if (task.dueDate <= window.weekEndIso) return "dueThisWeek";
  return "dueLater";
}

// Builds one staff member's report from the open tasks currently on their
// board (getTasksForStaff -- owned + temporarily reassigned, same set the
// My Work page shows). Exported separately from the Supabase-fetching
// wrapper below so the combined report can reuse it against a
// pre-aggregated task list without a second fetch per staff member.
export function computeStaffReport(
  staff: WorkflowStaff,
  tasks: TaskWithDetails[],
  window: ReportWindow,
  priorWeekTimesheet: PriorWeekTimesheet | null = null,
): StaffReportData {
  let overdueCount = 0;
  let dueThisWeekCount = 0;
  let dueLaterCount = 0;
  let basDueCount = 0;
  let payrollDueCount = 0;
  const dueThisWeekTasks: TaskLine[] = [];
  const overdueByCustomer = new Map<string, OverdueTaskLine[]>();

  for (const task of tasks) {
    const bucket = classify(task, window);
    if (!bucket) continue;

    const isTimeSensitive = bucket === "overdue" || bucket === "dueThisWeek";
    if (isTimeSensitive && task.typeName === BAS_TYPE_NAME) basDueCount += 1;
    if (isTimeSensitive && task.typeName === PAYROLL_TYPE_NAME) payrollDueCount += 1;

    if (bucket === "overdue") {
      overdueCount += 1;
      const line: OverdueTaskLine = {
        id: task.id,
        title: task.title,
        customerName: task.customerName,
        typeName: task.typeName,
        dueDate: task.dueDate as string,
        daysOverdue: daysOverdue(task.dueDate as string, window.todayIso),
      };
      const existing = overdueByCustomer.get(task.customerName);
      if (existing) existing.push(line);
      else overdueByCustomer.set(task.customerName, [line]);
    } else if (bucket === "dueThisWeek") {
      dueThisWeekCount += 1;
      dueThisWeekTasks.push({
        id: task.id,
        title: task.title,
        customerName: task.customerName,
        typeName: task.typeName,
        dueDate: task.dueDate as string,
      });
    } else {
      dueLaterCount += 1;
    }
  }

  const overdueByClient: ClientOverdueGroup[] = Array.from(overdueByCustomer.entries())
    .map(([customerName, taskLines]) => {
      const sorted = [...taskLines].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return {
        customerName,
        count: sorted.length,
        oldestDueDate: sorted[0].dueDate,
        tasks: sorted,
      };
    })
    .sort((a, b) => b.count - a.count || a.oldestDueDate.localeCompare(b.oldestDueDate));

  dueThisWeekTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    staff,
    window,
    overdueCount,
    dueThisWeekCount,
    dueLaterCount,
    basDueCount,
    payrollDueCount,
    dueThisWeekTasks,
    overdueByClient,
    priorWeekTimesheet,
  };
}

// The calendar week immediately before window's week -- i.e. the working
// week that just finished, which is what a Monday-morning report should be
// summarising (this week has barely started). Shared by the per-staff
// prior-week tile and the combined report's timesheet summary below, so
// the two can't drift apart on what "prior week" means.
function priorWeekRangeFromWindow(window: ReportWindow): { start: string; end: string } {
  const priorWeekEnd = new Date(window.weekStartIso + "T00:00:00Z");
  priorWeekEnd.setUTCDate(priorWeekEnd.getUTCDate() - 1);
  const priorWeekStart = new Date(priorWeekEnd);
  priorWeekStart.setUTCDate(priorWeekStart.getUTCDate() - 6);
  return {
    start: priorWeekStart.toISOString().slice(0, 10),
    end: priorWeekEnd.toISOString().slice(0, 10),
  };
}

async function fetchPriorWeekTimesheet(
  staff: WorkflowStaff,
  window: ReportWindow,
): Promise<PriorWeekTimesheet | null> {
  if (!staff.xpmStaffId || !isXpmConfigured()) return null;
  const settings = await getSettings();
  if (!settings.partnerName) return null;

  try {
    const timesheets = await getXpmTimesheets(settings.partnerName);
    const result = computeWagesUtilisation(timesheets, [staff.xpmStaffId], priorWeekRangeFromWindow(window), window.todayIso);
    return { loggedHours: result.loggedHours, standardHours: result.standardHours };
  } catch (err) {
    console.error("[mondayReport] fetchPriorWeekTimesheet failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// Fetches staff's own board and prior-week timesheet status, and builds
// their report -- the per-staff email route's entry point.
export async function buildStaffReportData(
  staff: WorkflowStaff,
  window: ReportWindow = buildReportWindow(),
): Promise<StaffReportData> {
  const [tasks, priorWeekTimesheet] = await Promise.all([
    getTasksForStaff(staff.id),
    fetchPriorWeekTimesheet(staff, window),
  ]);
  return computeStaffReport(staff, tasks, window, priorWeekTimesheet);
}

export interface FirmTotals {
  overdueCount: number;
  dueThisWeekCount: number;
  dueLaterCount: number;
  basDueCount: number;
  payrollDueCount: number;
}

// Firm-wide totals, deduplicated by task id -- computed straight off every
// task in the system rather than summed from per-staff mini-summaries, so a
// task temporarily reassigned (which appears on two staff boards) isn't
// double-counted, and an unassigned task is still represented.
function computeFirmTotals(allTasks: TaskWithDetails[], window: ReportWindow): FirmTotals {
  const totals: FirmTotals = {
    overdueCount: 0,
    dueThisWeekCount: 0,
    dueLaterCount: 0,
    basDueCount: 0,
    payrollDueCount: 0,
  };
  for (const task of allTasks) {
    const bucket = classify(task, window);
    if (!bucket) continue;
    if (bucket === "overdue") totals.overdueCount += 1;
    else if (bucket === "dueThisWeek") totals.dueThisWeekCount += 1;
    else totals.dueLaterCount += 1;

    const isTimeSensitive = bucket === "overdue" || bucket === "dueThisWeek";
    if (isTimeSensitive && task.typeName === BAS_TYPE_NAME) totals.basDueCount += 1;
    if (isTimeSensitive && task.typeName === PAYROLL_TYPE_NAME) totals.payrollDueCount += 1;
  }
  return totals;
}

export interface StaffMiniSummary {
  staffId: string;
  staffName: string;
  overdueCount: number;
  dueThisWeekCount: number;
  basDueCount: number;
  payrollDueCount: number;
}

export interface TimesheetSummaryRow {
  staffId: string;
  staffName: string;
  priorWeekHours: number;
  fytdHours: number;
}

export interface TopOverdueClient {
  customerName: string;
  count: number;
  oldestDueDate: string;
  // The staff member currently holding the most of this client's overdue
  // tasks -- an acceptable simplification over listing every holder, per
  // CLAUDE.md's brief for this section (a partner routing work needs a name
  // to call, not a full breakdown). Null if every one of the client's
  // overdue tasks is unassigned.
  topStaffName: string | null;
}

export interface CombinedReportData {
  window: ReportWindow;
  firmTotals: FirmTotals;
  staffSummaries: StaffMiniSummary[];
  topOverdueClients: TopOverdueClient[];
  timesheetSummaries: TimesheetSummaryRow[];
  timesheetsAvailable: boolean;
}

// How many clients the firm-wide "Top overdue clients" section on the
// combined/Partner report shows -- deliberately small since this is a
// partner-facing summary of where risk is concentrated, not a worklist.
export const TOP_OVERDUE_CLIENTS_LIMIT = 10;

// Firm-wide overdue tasks grouped by client (across every staff member,
// deduplicated the same way computeFirmTotals is -- straight off allTasks,
// not summed from per-staff groups, so a temporarily reassigned task isn't
// double-counted). Returns the top N clients by overdue count, along with
// whichever staff member currently holds the most of that client's overdue
// tasks.
function computeTopOverdueClients(
  allTasks: TaskWithDetails[],
  window: ReportWindow,
  staffById: Map<string, string>,
): TopOverdueClient[] {
  const byCustomer = new Map<string, { dueDates: string[]; staffCounts: Map<string, number> }>();

  for (const task of allTasks) {
    if (classify(task, window) !== "overdue") continue;
    let entry = byCustomer.get(task.customerName);
    if (!entry) {
      entry = { dueDates: [], staffCounts: new Map() };
      byCustomer.set(task.customerName, entry);
    }
    entry.dueDates.push(task.dueDate as string);
    const effectiveAssigneeId = task.tempAssigneeId ?? task.assigneeId;
    if (effectiveAssigneeId) {
      entry.staffCounts.set(effectiveAssigneeId, (entry.staffCounts.get(effectiveAssigneeId) ?? 0) + 1);
    }
  }

  const clients: TopOverdueClient[] = Array.from(byCustomer.entries()).map(([customerName, entry]) => {
    let topStaffId: string | null = null;
    let topStaffCount = 0;
    for (const [staffId, count] of entry.staffCounts) {
      if (count > topStaffCount) {
        topStaffId = staffId;
        topStaffCount = count;
      }
    }
    return {
      customerName,
      count: entry.dueDates.length,
      oldestDueDate: entry.dueDates.reduce((oldest, d) => (d < oldest ? d : oldest)),
      topStaffName: topStaffId ? staffById.get(topStaffId) ?? null : null,
    };
  });

  return clients
    .sort((a, b) => b.count - a.count || a.oldestDueDate.localeCompare(b.oldestDueDate))
    .slice(0, TOP_OVERDUE_CLIENTS_LIMIT);
}

// Total hours actually logged (client + leave + other-internal + idle -- see
// computeWagesUtilisation's own comment on the three-way split), not just
// billable hours -- a partner reading "who worked how much" wants the whole
// week's logged time, not only the billable slice of it.
function loggedHoursFor(
  timesheets: XpmTimesheet[],
  xpmStaffId: string | null,
  selection: Parameters<typeof computeWagesUtilisation>[2],
  todayIso: string,
): number {
  if (!xpmStaffId) return 0;
  return computeWagesUtilisation(timesheets, [xpmStaffId], selection, todayIso).loggedHours;
}

async function buildTimesheetSummaries(
  staffList: WorkflowStaff[],
  window: ReportWindow,
): Promise<{ rows: TimesheetSummaryRow[]; available: boolean }> {
  if (!isXpmConfigured()) return { rows: [], available: false };

  const settings = await getSettings();
  if (!settings.partnerName) return { rows: [], available: false };

  let timesheets: XpmTimesheet[];
  try {
    timesheets = await getXpmTimesheets(settings.partnerName);
  } catch (err) {
    console.error("[mondayReport] getXpmTimesheets failed -- timesheet summary omitted:", err instanceof Error ? err.message : err);
    return { rows: [], available: false };
  }

  const today = new Date(window.todayIso + "T00:00:00Z");
  const priorWeekRange = priorWeekRangeFromWindow(window);

  const { start: fyStart } = fyRange(fyYearFor(today));
  const fytdRange = { start: fyStart.toISOString().slice(0, 10), end: window.todayIso };

  const rows = staffList.map((staff) => ({
    staffId: staff.id,
    staffName: staff.name,
    priorWeekHours: loggedHoursFor(timesheets, staff.xpmStaffId, priorWeekRange, window.todayIso),
    fytdHours: loggedHoursFor(timesheets, staff.xpmStaffId, fytdRange, window.todayIso),
  }));

  return { rows, available: true };
}

// The firm-wide report sent to Partners: totals across every staff member,
// a per-staff mini-summary table, and an XPM-sourced timesheet summary.
export async function buildCombinedReportData(
  window: ReportWindow = buildReportWindow(),
): Promise<CombinedReportData> {
  const staffList = (await listStaff()).filter((s) => s.included);
  const allTasks = await getAllTasks();

  // Group every task by whoever currently holds it -- the temporary
  // assignee if it's been handed off, otherwise its permanent owner --
  // rather than reusing getTasksForStaff per staff member (which would
  // re-fetch the whole table once per person and double-count temporarily
  // reassigned tasks across two people's mini-summaries).
  const tasksByEffectiveAssignee = new Map<string, TaskWithDetails[]>();
  for (const task of allTasks) {
    const effectiveAssigneeId = task.tempAssigneeId ?? task.assigneeId;
    if (!effectiveAssigneeId) continue;
    const list = tasksByEffectiveAssignee.get(effectiveAssigneeId);
    if (list) list.push(task);
    else tasksByEffectiveAssignee.set(effectiveAssigneeId, [task]);
  }

  const staffSummaries: StaffMiniSummary[] = staffList.map((staff) => {
    const report = computeStaffReport(staff, tasksByEffectiveAssignee.get(staff.id) ?? [], window);
    return {
      staffId: staff.id,
      staffName: staff.name,
      overdueCount: report.overdueCount,
      dueThisWeekCount: report.dueThisWeekCount,
      basDueCount: report.basDueCount,
      payrollDueCount: report.payrollDueCount,
    };
  });

  const firmTotals = computeFirmTotals(allTasks, window);
  const staffNameById = new Map(staffList.map((s) => [s.id, s.name]));
  const topOverdueClients = computeTopOverdueClients(allTasks, window, staffNameById);
  const { rows: timesheetSummaries, available: timesheetsAvailable } = await buildTimesheetSummaries(staffList, window);

  return { window, firmTotals, staffSummaries, topOverdueClients, timesheetSummaries, timesheetsAvailable };
}

// Recipients, per CLAUDE.md's brief: individual reports go to every included
// staff member with an email set; the combined report goes to every
// included Partner. Both read from the staff table (not a hardcoded list)
// so a roster change doesn't need a code change.
export async function getIndividualReportRecipients(): Promise<WorkflowStaff[]> {
  const staffList = await listStaff();
  return staffList.filter((s) => s.included && s.email);
}

export async function getCombinedReportRecipients(): Promise<WorkflowStaff[]> {
  const staffList = await listStaff("Partner");
  return staffList.filter((s) => s.included && s.email);
}
