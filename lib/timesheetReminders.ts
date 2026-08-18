import { listStaff } from "./workflow";
import { getSettings } from "./settings";
import { getXpmTimesheets, isXpmConfigured } from "./xpm";
import { computeWagesUtilisation } from "./workOverview";
import { fyRange, fyYearFor } from "./utils";
import { getIndividualReportRecipients, getCombinedReportRecipients, aestTodayIso } from "./mondayReport";
import type { WorkflowStaff } from "@/types/workflow";
import type { XpmTimesheet } from "@/types/xpm";

// Weekly timesheet-submission reminder emails -- two cron entry points (see
// vercel.json and app/api/reports/timesheet-reminder|timesheet-followup):
// a Monday-morning nudge to everyone asking them to submit last week's
// timesheet, and a midday follow-up that only emails whoever's still short,
// plus a Partner-facing summary of who's incomplete and how the team's
// tracking FY-to-date. Reuses lib/mondayReport.ts's AEST wall-clock helper
// and recipient lists rather than redefining them -- same roster, same
// "included staff" convention (§6.3).

export { aestTodayIso };

export interface PriorWeek {
  startIso: string; // Monday
  endIso: string; // Sunday
}

// The calendar week that just finished -- Monday's reminder is about THIS,
// not the week that's just started (which has barely any hours logged
// against it yet). Same "week immediately before this one" math as
// lib/mondayReport.ts's buildTimesheetSummaries.
export function priorWeekFor(todayIso: string): PriorWeek {
  const today = new Date(todayIso + "T00:00:00Z");
  const day = today.getUTCDay(); // 0 = Sunday
  const diffToThisMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(today);
  thisMonday.setUTCDate(thisMonday.getUTCDate() - diffToThisMonday);
  const priorSunday = new Date(thisMonday);
  priorSunday.setUTCDate(priorSunday.getUTCDate() - 1);
  const priorMonday = new Date(priorSunday);
  priorMonday.setUTCDate(priorMonday.getUTCDate() - 6);
  return {
    startIso: priorMonday.toISOString().slice(0, 10),
    endIso: priorSunday.toISOString().slice(0, 10),
  };
}

export interface TimesheetStatusRow {
  staffId: string;
  staffName: string;
  email: string;
  loggedHours: number;
  standardHours: number; // 38 for one full week, one person -- computeWagesUtilisation's own denominator
  complete: boolean;
}

// Per-person logged-vs-standard hours for the given (already-finished) week.
// Only staff linked to an XPM staff record can be measured at all -- same
// gap Timesheets and Team already have (§6.3's "No XPM staff with this
// email" case).
function computeWeekStatus(
  staffList: WorkflowStaff[],
  timesheets: XpmTimesheet[],
  week: PriorWeek,
  todayIso: string,
): TimesheetStatusRow[] {
  return staffList
    .filter((s): s is WorkflowStaff & { xpmStaffId: string } => Boolean(s.xpmStaffId))
    .map((s) => {
      const result = computeWagesUtilisation(
        timesheets,
        [s.xpmStaffId],
        { start: week.startIso, end: week.endIso },
        todayIso,
      );
      return {
        staffId: s.id,
        staffName: s.name,
        email: s.email,
        loggedHours: result.loggedHours,
        standardHours: result.standardHours,
        complete: result.loggedHours >= result.standardHours,
      };
    });
}

// FY-to-date billable-against-capacity across the whole team at once (not
// an average of individual %s) -- the same aggregate figure the Timesheets
// page's top tile shows for "This FY", and the same one lib/leaderboard.ts
// weighs at 50%, "the one to performance-manage on" (§6.1). A per-employee
// breakdown of this already lives on that page (select "This FY"), so the
// Partner email surfaces just the one firm-wide number rather than
// re-rendering that table -- see /timesheets for the full breakdown.
function computeFirmFytdBillable(
  staffList: WorkflowStaff[],
  timesheets: XpmTimesheet[],
  todayIso: string,
): number | null {
  const today = new Date(todayIso + "T00:00:00Z");
  const { start } = fyRange(fyYearFor(today));
  const fytdRange = { start: start.toISOString().slice(0, 10), end: todayIso };
  const xpmStaffIds = staffList
    .filter((s): s is WorkflowStaff & { xpmStaffId: string } => Boolean(s.xpmStaffId))
    .map((s) => s.xpmStaffId);
  if (xpmStaffIds.length === 0) return null;
  return computeWagesUtilisation(timesheets, xpmStaffIds, fytdRange, todayIso).billableCapacityPct;
}

export interface SubmitReminderData {
  staff: WorkflowStaff;
  priorWeek: PriorWeek;
}

// Every included staff member with an email gets the Monday-morning nudge,
// regardless of whether they're linked to XPM yet or how much they logged --
// this is just "please submit", not a status check (that's the midday
// follow-up below).
export async function getSubmitReminderRecipients(): Promise<WorkflowStaff[]> {
  return getIndividualReportRecipients();
}

export function buildSubmitReminderData(staff: WorkflowStaff, todayIso: string = aestTodayIso()): SubmitReminderData {
  return { staff, priorWeek: priorWeekFor(todayIso) };
}

export interface FollowUpData {
  priorWeek: PriorWeek;
  // Staff still short of their standard hours for priorWeek -- the
  // individual follow-up nudge goes only to these people, and this same
  // list is the "still incomplete" table in the Partner summary.
  incomplete: TimesheetStatusRow[];
  // Firm-wide FY-to-date billable % against capacity, across every
  // included non-Partner staff member at once -- Partners are excluded
  // here for the same reason they're excluded from every other
  // billable/utilisation figure in this app (§6.1): no delivery workload,
  // so including them would misrepresent the team's billable performance.
  firmFytdBillableCapacityPct: number | null;
  timesheetsAvailable: boolean;
  unavailableReason: string | null;
}

export async function buildFollowUpData(todayIso: string = aestTodayIso()): Promise<FollowUpData> {
  const priorWeek = priorWeekFor(todayIso);
  const staffList = (await listStaff()).filter((s) => s.included);

  if (!isXpmConfigured()) {
    return {
      priorWeek,
      incomplete: [],
      firmFytdBillableCapacityPct: null,
      timesheetsAvailable: false,
      unavailableReason: "XPM isn't configured (XPM_CLIENT_ID etc. not set).",
    };
  }

  const settings = await getSettings();
  if (!settings.partnerName) {
    return {
      priorWeek,
      incomplete: [],
      firmFytdBillableCapacityPct: null,
      timesheetsAvailable: false,
      unavailableReason: "Set a Partner name in Settings to sync XPM timesheets.",
    };
  }

  let timesheets: XpmTimesheet[];
  try {
    timesheets = await getXpmTimesheets(settings.partnerName);
  } catch (err) {
    console.error("[timesheetReminders] getXpmTimesheets failed:", err instanceof Error ? err.message : err);
    return {
      priorWeek,
      incomplete: [],
      firmFytdBillableCapacityPct: null,
      timesheetsAvailable: false,
      unavailableReason: err instanceof Error ? err.message : "Failed to load timesheets from XPM.",
    };
  }

  const statusRows = computeWeekStatus(staffList, timesheets, priorWeek, todayIso);
  const incomplete = statusRows.filter((r) => !r.complete).sort((a, b) => a.staffName.localeCompare(b.staffName));

  const nonPartnerStaff = staffList.filter((s) => s.role !== "Partner");
  const firmFytdBillableCapacityPct = computeFirmFytdBillable(nonPartnerStaff, timesheets, todayIso);

  return { priorWeek, incomplete, firmFytdBillableCapacityPct, timesheetsAvailable: true, unavailableReason: null };
}

// Partners get the summary email (who's still incomplete + the FYTD
// billable overview) -- same recipient rule as the Monday Report's combined
// report.
export async function getFollowUpSummaryRecipients(): Promise<WorkflowStaff[]> {
  return getCombinedReportRecipients();
}

// ── Personal, multi-week shortfall (draft #4) ──────────────────────────
//
// The single-week nudge above tells someone they're short THIS week, but
// says nothing about a week from a month ago that never got topped up --
// each week is judged independently and then forgotten. This instead looks
// back across every completed week of the current FY and lists every one
// that's still short, so a person (and whoever else reads their email) can
// see the whole open backlog in one place, not just the most recent gap.

export interface WeekShortfall {
  startIso: string; // Monday
  endIso: string; // Sunday
  loggedHours: number;
  standardHours: number;
  hoursShort: number;
}

// Every completed Monday-Sunday week from fromIso through priorWeek
// (inclusive) -- the current, still-in-progress week is deliberately
// excluded since it can't be judged short yet (same reasoning as
// priorWeekFor itself).
function completedWeeksSince(fromIso: string, priorWeek: PriorWeek): PriorWeek[] {
  const weeks: PriorWeek[] = [];
  const cursor = new Date(fromIso + "T00:00:00Z");
  const lastEnd = new Date(priorWeek.endIso + "T00:00:00Z");
  while (cursor.getTime() <= lastEnd.getTime()) {
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + 6);
    weeks.push({ startIso: cursor.toISOString().slice(0, 10), endIso: end.toISOString().slice(0, 10) });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return weeks;
}

export interface PersonalShortfallData {
  staffId: string;
  staffName: string;
  email: string;
  rangeStartIso: string; // start of the current FY
  rangeEndIso: string; // end of the last completed week
  shortWeeks: WeekShortfall[];
  totalHoursShort: number;
  // This person's own FY-to-date figures -- billableCapacityPct is the
  // same "performance-manage on" figure the Partner summary shows for
  // everyone (§6.1), pct is how much of their capacity is accounted for at
  // all (the "logged %" half of the ask), and fytdHours is their logged
  // hours for context.
  fytdBillableCapacityPct: number | null;
  fytdLoggedPct: number;
  fytdHours: number;
}

function computeShortfallForStaff(
  staff: WorkflowStaff & { xpmStaffId: string },
  timesheets: XpmTimesheet[],
  weeks: PriorWeek[],
  fytdRange: { start: string; end: string },
  todayIso: string,
): PersonalShortfallData {
  const shortWeeks: WeekShortfall[] = [];
  for (const week of weeks) {
    const result = computeWagesUtilisation(
      timesheets,
      [staff.xpmStaffId],
      { start: week.startIso, end: week.endIso },
      todayIso,
    );
    const hoursShort = Math.max(0, result.standardHours - result.loggedHours);
    if (hoursShort > 0) {
      shortWeeks.push({
        startIso: week.startIso,
        endIso: week.endIso,
        loggedHours: result.loggedHours,
        standardHours: result.standardHours,
        hoursShort,
      });
    }
  }

  const fytd = computeWagesUtilisation(timesheets, [staff.xpmStaffId], fytdRange, todayIso);

  return {
    staffId: staff.id,
    staffName: staff.name,
    email: staff.email,
    rangeStartIso: weeks[0]?.startIso ?? todayIso,
    rangeEndIso: weeks[weeks.length - 1]?.endIso ?? todayIso,
    shortWeeks,
    totalHoursShort: shortWeeks.reduce((sum, w) => sum + w.hoursShort, 0),
    fytdBillableCapacityPct: fytd.billableCapacityPct,
    fytdLoggedPct: fytd.pct,
    fytdHours: fytd.loggedHours,
  };
}

// One row per included, XPM-linked staff member who has at least one short
// week this FY -- staff with a clean record aren't included at all (nothing
// to send them). Same XPM-availability guards as buildFollowUpData.
export async function buildPersonalShortfallData(todayIso: string = aestTodayIso()): Promise<PersonalShortfallData[]> {
  if (!isXpmConfigured()) return [];

  const settings = await getSettings();
  if (!settings.partnerName) return [];

  let timesheets: XpmTimesheet[];
  try {
    timesheets = await getXpmTimesheets(settings.partnerName);
  } catch (err) {
    console.error("[timesheetReminders] getXpmTimesheets failed:", err instanceof Error ? err.message : err);
    return [];
  }

  const staffList = (await listStaff())
    .filter((s) => s.included)
    .filter((s): s is WorkflowStaff & { xpmStaffId: string } => Boolean(s.xpmStaffId));

  const priorWeek = priorWeekFor(todayIso);
  const today = new Date(todayIso + "T00:00:00Z");
  const { start: fyStart } = fyRange(fyYearFor(today));
  const fyStartIso = fyStart.toISOString().slice(0, 10);
  const weeks = completedWeeksSince(fyStartIso, priorWeek);
  const fytdRange = { start: fyStartIso, end: todayIso };

  return staffList
    .map((s) => computeShortfallForStaff(s, timesheets, weeks, fytdRange, todayIso))
    .filter((d) => d.shortWeeks.length > 0)
    .sort((a, b) => b.totalHoursShort - a.totalHoursShort);
}
