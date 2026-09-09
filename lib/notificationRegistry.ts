import { listStaff } from "./workflow";
import {
  buildStaffReportData,
  buildCombinedReportData,
  getIndividualReportRecipients,
  getCombinedReportRecipients,
} from "./mondayReport";
import { renderStaffReportEmail, renderCombinedReportEmail } from "./emailTemplates/mondayReport";
import {
  buildSubmitReminderData,
  buildFollowUpData,
  buildPersonalShortfallData,
  getSubmitReminderRecipients,
  getFollowUpSummaryRecipients,
} from "./timesheetReminders";
import {
  renderSubmitReminderEmail,
  renderFollowUpNudgeEmail,
  renderFollowUpSummaryEmail,
  renderPersonalShortfallEmail,
} from "./emailTemplates/timesheetReminders";
import { buildDailyDigestData, getDailyDigestRecipients } from "./dailyDigest";
import { renderDailyDigestEmail } from "./emailTemplates/dailyDigest";
import { renderBasWorkflowClientEmail } from "./emailTemplates/basWorkflowClient";
import type { EmailContent } from "./emailTemplates/shared";
import type { WorkflowStaff } from "@/types/workflow";

// The catalog behind Settings -> Notifications -- one entry per automated
// email this app sends (or, for "draft" ones, will send once built).
// Deliberately the single source of truth for that page's listing *and*
// its "View template" preview route (app/api/admin/notifications/[key]/
// preview/route.ts), so the two can't drift apart on what exists.
//
// Preview rendering reuses each notification's *real* build*/render*
// functions against live current data rather than fabricated samples --
// genuinely more useful to an admin checking "what does this actually look
// like right now", and avoids a second, parallel set of sample data that
// would need to be kept in sync with every interface change by hand.

export type NotificationCategory = "staff" | "partner" | "client";
export type NotificationStatus = "live" | "draft";

export interface NotificationDefinition {
  key: string;
  name: string;
  category: NotificationCategory;
  audienceLabel: string;
  scheduleLabel: string;
  // The cron route that actually fires this, for reference -- null for a
  // "draft" notification with no schedule wired up yet.
  route: string | null;
  status: NotificationStatus;
  // Every included staff member currently in this notification's recipient
  // pool -- there's no per-notification override in the data model yet
  // (every staff-facing email goes to the same "included staff" pool,
  // every Partner-facing one to the same "included Partner" pool), so this
  // reflects real, current behaviour rather than a stored preference.
  resolveRecipients(): Promise<WorkflowStaff[]>;
  buildPreview(): Promise<EmailContent>;
}

// Used by every staff-scoped preview (there's no "preview as" picker yet) --
// the first included, currently-real staff member, so a preview reflects
// genuine current data rather than a fabricated sample.
async function firstIncludedStaff(): Promise<WorkflowStaff> {
  const staff = (await listStaff()).filter((s) => s.included);
  if (!staff[0]) throw new Error("No included staff member to preview this against yet.");
  return staff[0];
}

export const NOTIFICATION_DEFINITIONS: NotificationDefinition[] = [
  {
    key: "overdue-summary",
    name: "Overdue Summary",
    category: "partner",
    audienceLabel: "Partner",
    scheduleLabel: "Sun 12:00pm AEST",
    route: "/api/reports/overdue-summary",
    status: "live",
    resolveRecipients: getCombinedReportRecipients,
    buildPreview: async () => renderCombinedReportEmail(await buildCombinedReportData()),
  },
  {
    key: "workflow-update",
    name: "Workflow Update",
    category: "staff",
    audienceLabel: "Each employee",
    scheduleLabel: "Mon 7:00am AEST",
    route: "/api/reports/monday-report",
    status: "live",
    resolveRecipients: getIndividualReportRecipients,
    buildPreview: async () => renderStaffReportEmail(await buildStaffReportData(await firstIncludedStaff())),
  },
  {
    key: "timesheet-reminder-1",
    name: "Timesheet Reminder #1",
    category: "staff",
    audienceLabel: "Each employee",
    scheduleLabel: "Mon 8:00am AEST",
    route: "/api/reports/timesheet-reminder",
    status: "live",
    resolveRecipients: getSubmitReminderRecipients,
    buildPreview: async () => renderSubmitReminderEmail(buildSubmitReminderData(await firstIncludedStaff())),
  },
  {
    key: "timesheet-reminder-2",
    name: "Timesheet Reminder #2",
    category: "staff",
    audienceLabel: "Employees still short (last week)",
    scheduleLabel: "Mon 10:00am AEST",
    route: "/api/reports/timesheet-reminder-2",
    status: "live",
    resolveRecipients: async () => (await buildFollowUpData()).incomplete.length > 0 ? getIndividualReportRecipients() : [],
    buildPreview: async () => {
      const data = await buildFollowUpData();
      const row = data.incomplete[0];
      if (!row) throw new Error("Nobody is currently short of last week's standard hours — nothing to preview right now.");
      return renderFollowUpNudgeEmail(row, data.priorWeek);
    },
  },
  {
    key: "timesheet-summary",
    name: "Timesheet Summary",
    category: "partner",
    audienceLabel: "Partner",
    scheduleLabel: "Mon 12:00pm AEST",
    route: "/api/reports/timesheet-followup",
    status: "live",
    resolveRecipients: getFollowUpSummaryRecipients,
    buildPreview: async () => renderFollowUpSummaryEmail(await buildFollowUpData()),
  },
  {
    key: "timesheet-overview",
    name: "Timesheet Overview",
    category: "staff",
    audienceLabel: "Employees still short (this FY)",
    scheduleLabel: "Mon 12:00pm AEST",
    route: "/api/reports/timesheet-followup",
    status: "live",
    resolveRecipients: async () => (await buildPersonalShortfallData()).length > 0 ? getIndividualReportRecipients() : [],
    buildPreview: async () => {
      const rows = await buildPersonalShortfallData();
      const row = rows[0];
      if (!row) throw new Error("Nobody currently has an open FY shortfall — nothing to preview right now.");
      return renderPersonalShortfallEmail(row);
    },
  },
  {
    key: "daily-digest",
    name: "Daily Digest",
    category: "staff",
    audienceLabel: "Each employee",
    scheduleLabel: "Tue–Sun 7:00am AEST",
    route: "/api/reports/daily-digest",
    status: "live",
    resolveRecipients: getDailyDigestRecipients,
    buildPreview: async () => renderDailyDigestEmail(await buildDailyDigestData(await firstIncludedStaff())),
  },
  // Client-facing, drafted per the practice's request -- see
  // lib/emailTemplates/basWorkflowClient.ts's own comment for exactly what
  // this is missing before it could actually fire (client contact emails,
  // a schedule engine for the per-task trigger being drafted on the task
  // modal). resolveRecipients has nothing real to return yet.
  {
    key: "bas-workflow-client",
    name: "BAS Workflow",
    category: "client",
    audienceLabel: "Client contact (not yet modelled — no email field on customers)",
    scheduleLabel: "Per-task: start date, a specific date, or daily/weekly/monthly/quarterly",
    route: null,
    status: "draft",
    resolveRecipients: async () => [],
    buildPreview: async () =>
      renderBasWorkflowClientEmail({
        clientName: "Acme Pty Ltd",
        taskTitle: "August BAS lodgement",
        periodLabel: "Aug 26 BAS",
        stageLabel: "being prepared",
        dueDate: "2026-09-28",
      }),
  },
];

export function getNotificationDefinition(key: string): NotificationDefinition | undefined {
  return NOTIFICATION_DEFINITIONS.find((d) => d.key === key);
}
