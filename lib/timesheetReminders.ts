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

export interface FytdBillableRow {
  staffId: string;
  staffName: string;
  fytdHours: number;
  fytdBillableCapacityPct: number | null;
}

// FY-to-date billable-against-capacity per staff member -- the same figure
// lib/leaderboard.ts weighs at 50%, "the one to performance-manage on"
// (§6.1), not the share-of-logged figure that flatters under-loggers.
function computeFytdBillable(
  staffList: WorkflowStaff[],
  timesheets: XpmTimesheet[],
  todayIso: string,
): FytdBillableRow[] {
  const today = new Date(todayIso + "T00:00:00Z");
  const { start } = fyRange(fyYearFor(today));
  const fytdRange = { start: start.toISOString().slice(0, 10), end: todayIso };

  return staffList
    .filter((s): s is WorkflowStaff & { xpmStaffId: string } => Boolean(s.xpmStaffId))
    .map((s) => {
      const result = computeWagesUtilisation(timesheets, [s.xpmStaffId], fytdRange, todayIso);
      return {
        staffId: s.id,
        staffName: s.name,
        fytdHours: result.clientHours,
        fytdBillableCapacityPct: result.billableCapacityPct,
      };
    });
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
  // Every included non-Partner staff member's FY-to-date billable %,
  // regardless of last week's status -- Partners are excluded here for the
  // same reason they're excluded from every other billable/utilisation
  // figure in this app (§6.1): no delivery workload, so including them
  // would misrepresent the team's billable performance.
  fytdBillable: FytdBillableRow[];
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
      fytdBillable: [],
      timesheetsAvailable: false,
      unavailableReason: "XPM isn't configured (XPM_CLIENT_ID etc. not set).",
    };
  }

  const settings = await getSettings();
  if (!settings.partnerName) {
    return {
      priorWeek,
      incomplete: [],
      fytdBillable: [],
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
      fytdBillable: [],
      timesheetsAvailable: false,
      unavailableReason: err instanceof Error ? err.message : "Failed to load timesheets from XPM.",
    };
  }

  const statusRows = computeWeekStatus(staffList, timesheets, priorWeek, todayIso);
  const incomplete = statusRows.filter((r) => !r.complete).sort((a, b) => a.staffName.localeCompare(b.staffName));

  const nonPartnerStaff = staffList.filter((s) => s.role !== "Partner");
  const fytdBillable = computeFytdBillable(nonPartnerStaff, timesheets, todayIso).sort(
    (a, b) => (b.fytdBillableCapacityPct ?? -1) - (a.fytdBillableCapacityPct ?? -1),
  );

  return { priorWeek, incomplete, fytdBillable, timesheetsAvailable: true, unavailableReason: null };
}

// Partners get the summary email (who's still incomplete + the FYTD
// billable overview) -- same recipient rule as the Monday Report's combined
// report.
export async function getFollowUpSummaryRecipients(): Promise<WorkflowStaff[]> {
  return getCombinedReportRecipients();
}
