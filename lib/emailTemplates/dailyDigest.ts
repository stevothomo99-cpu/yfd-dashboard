import type { DailyDigestData, DailyDigestTaskLine } from "@/lib/dailyDigest";
import { COLORS, escapeHtml, fmtDate, fmtGeneratedAt, htmlShell, masthead, sectionCard, tilesRow } from "./shared";
import type { EmailContent } from "./shared";

// Email-client-safe HTML for the daily digest -- same shared primitives as
// the Monday Report and timesheet reminders (./shared), table-based/
// inline-styles-only for the same Outlook/mobile-mail-client reasons.

const FOOTER_TEXT =
  "YFD Dashboard — automated daily digest. Generated from live workflow data; if a number looks off, check /my-work directly before assuming the email is stale.";

function taskListTable(tasks: DailyDigestTaskLine[], emptyText: string): string {
  if (tasks.length === 0) {
    return `<div style="font-size:13px;color:${COLORS.muted};">${escapeHtml(emptyText)}</div>`;
  }
  const rows = tasks
    .map(
      (t) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.text};">${escapeHtml(t.title)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.muted};">${escapeHtml(t.customerName)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.muted};white-space:nowrap;">${escapeHtml(t.typeName ?? "—")}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.text};font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right;">${fmtDate(t.dueDate)}</td>
    </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;">Task</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;">Client</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;">Type</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">Due</td>
    </tr>
    ${rows}
  </table>`;
}

export function renderDailyDigestEmail(data: DailyDigestData): EmailContent {
  const firstName = data.staff.name.split(" ")[0];
  const dateLabel = fmtDate(data.todayIso);
  const generatedAtIso = new Date().toISOString();
  const subject = `Daily digest — ${data.overdueCount} overdue, ${data.dueTodayCount} due today (${dateLabel})`;

  const tiles = tilesRow([
    { label: "Overdue", value: data.overdueCount, tone: data.overdueCount > 0 ? "red" : "green" },
    { label: "Due today", value: data.dueTodayCount, tone: data.dueTodayCount > 0 ? "amber" : "green" },
  ]);

  const bodyHtml = `
    ${masthead(`Daily Digest — ${escapeHtml(data.staff.name)}`, dateLabel, generatedAtIso)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-top:none;">
      <tr><td style="padding:18px 24px;">${tiles}</td></tr>
    </table>
    ${sectionCard("Due today", taskListTable(data.dueTodayTasks, "Nothing due today."))}
    ${sectionCard("Overdue", taskListTable(data.overdueTasks, "No overdue work — nice."))}
  `;
  const html = htmlShell(`${data.overdueCount} overdue, ${data.dueTodayCount} due today`, bodyHtml, FOOTER_TEXT);

  const textLines: string[] = [];
  textLines.push(`DAILY DIGEST — ${data.staff.name}`);
  textLines.push(dateLabel);
  textLines.push("");
  textLines.push(`Overdue: ${data.overdueCount}`);
  textLines.push(`Due today: ${data.dueTodayCount}`);
  textLines.push("");
  textLines.push(`Hi ${firstName}, here's what's overdue and due today.`);
  textLines.push("");
  textLines.push("DUE TODAY");
  if (data.dueTodayTasks.length === 0) textLines.push("  (nothing due today)");
  for (const t of data.dueTodayTasks) {
    textLines.push(`  - ${t.title} (${t.customerName})`);
  }
  textLines.push("");
  textLines.push("OVERDUE");
  if (data.overdueTasks.length === 0) textLines.push("  (no overdue work)");
  for (const t of data.overdueTasks) {
    textLines.push(`  - ${t.title} (${t.customerName}) — due ${fmtDate(t.dueDate)}`);
  }
  textLines.push("");
  textLines.push(`Generated ${fmtGeneratedAt(generatedAtIso)}`);

  return { subject, html, text: textLines.join("\n") };
}
