import { COLORS, escapeHtml, fmtDate, fmtGeneratedAt, htmlShell, masthead, sectionCard } from "./shared";
import type { EmailContent } from "./shared";

// Draft template for the first "client-facing" notification (§ Settings ->
// Notifications). Everything staff/Partner-facing so far (mondayReport.ts,
// timesheetReminders.ts, dailyDigest.ts) emails the practice's own team;
// this is the first one meant to go to an actual client contact instead.
//
// **Not wired to send anything yet** -- there is no client contact email
// field in the data model (customers only carries partner_id/manager_id,
// both internal staff allocations), no schedule engine for the per-task
// "fire on start date / a specific date / daily-weekly-monthly-quarterly"
// picker being drafted on the task modal, and no real per-task content
// beyond this static shape. This exists purely so the "View template" link
// on the Notifications settings page has something real to render against
// sample data -- see NOTIFICATION_DEFINITIONS in lib/notificationRegistry.ts.

export interface BasWorkflowClientPreviewData {
  clientName: string;
  taskTitle: string;
  periodLabel: string;
  stageLabel: string;
  dueDate: string;
}

const FOOTER_TEXT =
  "Your Finance Department — this is a draft template for a not-yet-built client-facing notification. It has not been sent to any real client.";

export function renderBasWorkflowClientEmail(data: BasWorkflowClientPreviewData): EmailContent {
  const generatedAtIso = new Date().toISOString();
  const subject = `${data.periodLabel} update — ${data.taskTitle}`;

  const bodyHtml = `
    ${masthead("BAS Workflow Update", escapeHtml(data.clientName), generatedAtIso)}
    ${sectionCard(
      "Where things stand",
      `<div style="font-size:13px;color:${COLORS.text};line-height:1.6;">
        Hi there,<br/><br/>
        Just a quick update on your <strong>${escapeHtml(data.periodLabel)}</strong> — currently
        <strong>${escapeHtml(data.stageLabel)}</strong>. We expect to have this lodged by
        ${escapeHtml(fmtDate(data.dueDate))}.<br/><br/>
        Let us know if you have any questions in the meantime.
      </div>`,
    )}
  `;
  const html = htmlShell(`${data.periodLabel} — ${data.stageLabel}`, bodyHtml, FOOTER_TEXT);

  const text = [
    `${data.periodLabel} update`,
    "",
    `Hi there, just a quick update on your ${data.periodLabel} -- currently ${data.stageLabel}.`,
    `We expect to have this lodged by ${fmtDate(data.dueDate)}.`,
    "",
    `Generated ${fmtGeneratedAt(generatedAtIso)}`,
  ].join("\n");

  return { subject, html, text };
}
