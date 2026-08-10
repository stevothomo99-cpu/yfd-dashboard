import type {
  ClientOverdueGroup,
  CombinedReportData,
  StaffReportData,
  TaskLine,
  TopOverdueClient,
} from "@/lib/mondayReport";
import { COLORS, escapeHtml, fmtDate, fmtDateRange, fmtGeneratedAt, htmlShell, masthead, sectionCard, tilesRow } from "./shared";
import type { EmailContent } from "./shared";

// Email-client-safe HTML for the weekly Monday Report -- shared primitives
// (masthead/tiles/section cards/htmlShell) live in ./shared, now that the
// timesheet reminder emails need the exact same building blocks. What's left
// here is Monday-Report-specific content: task lists, the overdue-by-client
// breakdown, and the firm-wide/timesheet tables.

const FOOTER_TEXT =
  "YFD Dashboard — automated Monday Report. Generated from live workflow data; if a number looks off, check the dashboard directly before assuming the email is stale.";

// The per-staff "Overdue, by client" section deliberately shows every
// overdue task for every client, uncapped -- per Steve: nobody should have
// this many items overdue, so the full, uncomfortable size of the list is
// meant to be seen, not hidden behind a "+N more". One consequence: a large
// backlog (one real example: 360 overdue tasks across 20 clients) can push
// past Gmail's ~102KB clip threshold, which just adds a "view entire
// message" link in Gmail specifically -- not a failure, just one extra
// click there.

function taskListTable(tasks: TaskLine[], emptyText: string): string {
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

// Deliberately shows every overdue task for every client, no cap -- the
// full, uncomfortable length of this section *is* the point (per Steve: "no
// one should have that many items overdue" -- the visible size of the
// backlog is meant to prompt action, not be hidden behind a "+N more").
function overdueByClientTable(groups: ClientOverdueGroup[]): string {
  if (groups.length === 0) {
    return `<div style="font-size:13px;color:${COLORS.muted};">No overdue work — nice.</div>`;
  }

  return groups
    .map((group) => {
      const taskRows = group.tasks
        .map(
          (t) => `
      <tr>
        <td style="padding:5px 8px 5px 20px;border-bottom:1px solid ${COLORS.border};font-size:12px;color:${COLORS.text};">${escapeHtml(t.title)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid ${COLORS.border};font-size:12px;color:${COLORS.muted};white-space:nowrap;">${escapeHtml(t.typeName ?? "—")}</td>
        <td style="padding:5px 8px;border-bottom:1px solid ${COLORS.border};font-size:12px;color:${COLORS.text};font-variant-numeric:tabular-nums;white-space:nowrap;">${fmtDate(t.dueDate)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid ${COLORS.border};font-size:12px;color:${COLORS.red};font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right;">${t.daysOverdue}d</td>
      </tr>`,
        )
        .join("");
      return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr>
          <td colspan="4" style="padding:8px 8px;background-color:${COLORS.bg};border-radius:4px;font-size:13px;font-weight:600;color:${COLORS.text};">
            ${escapeHtml(group.customerName)}
            <span style="color:${COLORS.red};font-weight:700;">&nbsp;·&nbsp;${group.count} overdue</span>
            <span style="color:${COLORS.muted};font-weight:400;">&nbsp;·&nbsp;oldest due ${fmtDate(group.oldestDueDate)}</span>
          </td>
        </tr>
        ${taskRows}
      </table>`;
    })
    .join("");
}

function topOverdueClientsTable(clients: TopOverdueClient[]): string {
  if (clients.length === 0) {
    return `<div style="font-size:13px;color:${COLORS.muted};">No overdue work firm-wide — nice.</div>`;
  }
  const rows = clients
    .map(
      (c) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.text};">${escapeHtml(c.customerName)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;text-align:right;color:${COLORS.red};">${c.count}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right;color:${COLORS.text};">${fmtDate(c.oldestDueDate)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.muted};">${escapeHtml(c.topStaffName ?? "Unassigned")}</td>
    </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;">Client</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">Overdue</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">Oldest due</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;">Held by</td>
    </tr>
    ${rows}
  </table>`;
}

// ── Per-staff report ────────────────────────────────────────────────────

export function renderStaffReportEmail(data: StaffReportData): EmailContent {
  const firstName = data.staff.name.split(" ")[0];
  const rangeLabel = fmtDateRange(data.window.weekStartIso, data.window.weekEndIso);
  const subject = `Monday Report — week of ${fmtDate(data.window.weekStartIso)} (${data.overdueCount} overdue, ${data.dueThisWeekCount} due this week)`;

  const mainTiles = tilesRow([
    { label: "Overdue", value: data.overdueCount, tone: data.overdueCount > 0 ? "red" : "default" },
    { label: "Due this week", value: data.dueThisWeekCount, tone: data.dueThisWeekCount > 0 ? "amber" : "default" },
    { label: "Due later", value: data.dueLaterCount },
  ]);
  const deadlineTiles = tilesRow([
    { label: "BAS/IAS due", value: data.basDueCount, tone: data.basDueCount > 0 ? "amber" : "default" },
    { label: "Payroll due", value: data.payrollDueCount, tone: data.payrollDueCount > 0 ? "amber" : "default" },
  ]);

  const bodyHtml = `
    ${masthead(`Monday Report — ${escapeHtml(data.staff.name)}`, `Week of ${escapeHtml(rangeLabel)}`, data.window.generatedAtIso)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-top:none;">
      <tr><td style="padding:18px 24px 6px 24px;">${mainTiles}</td></tr>
      <tr><td style="padding:6px 24px 18px 24px;">${deadlineTiles}</td></tr>
    </table>
    ${sectionCard("Due this week", taskListTable(data.dueThisWeekTasks, "Nothing due this week."))}
    ${sectionCard("Overdue, by client", overdueByClientTable(data.overdueByClient))}
  `;
  const html = htmlShell(`${data.overdueCount} overdue, ${data.dueThisWeekCount} due this week`, bodyHtml, FOOTER_TEXT);

  const textLines: string[] = [];
  textLines.push(`MONDAY REPORT — ${data.staff.name}`);
  textLines.push(`Week of ${rangeLabel}`);
  textLines.push("");
  textLines.push(`Overdue: ${data.overdueCount}`);
  textLines.push(`Due this week: ${data.dueThisWeekCount}`);
  textLines.push(`Due later: ${data.dueLaterCount}`);
  textLines.push(`BAS/IAS due: ${data.basDueCount}`);
  textLines.push(`Payroll due: ${data.payrollDueCount}`);
  textLines.push("");
  textLines.push(`Hi ${firstName}, here's what's on your plate this week.`);
  textLines.push("");
  textLines.push("DUE THIS WEEK");
  if (data.dueThisWeekTasks.length === 0) textLines.push("  (nothing due this week)");
  for (const t of data.dueThisWeekTasks) {
    textLines.push(`  - ${t.title} (${t.customerName}) — due ${fmtDate(t.dueDate)}`);
  }
  textLines.push("");
  textLines.push("OVERDUE, BY CLIENT");
  if (data.overdueByClient.length === 0) textLines.push("  (no overdue work)");
  for (const group of data.overdueByClient) {
    textLines.push(`  ${group.customerName} — ${group.count} overdue, oldest due ${fmtDate(group.oldestDueDate)}`);
    for (const t of group.tasks) {
      textLines.push(`    - ${t.title} (${t.typeName ?? "—"}) — due ${fmtDate(t.dueDate)}, ${t.daysOverdue}d overdue`);
    }
  }
  textLines.push("");
  textLines.push(`Generated ${fmtGeneratedAt(data.window.generatedAtIso)}`);

  return { subject, html, text: textLines.join("\n") };
}

// ── Combined / partner report ──────────────────────────────────────────

function staffMiniTable(data: CombinedReportData): string {
  const rows = data.staffSummaries
    .map(
      (s) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.text};">${escapeHtml(s.staffName)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;text-align:right;color:${s.overdueCount > 0 ? COLORS.red : COLORS.text};">${s.overdueCount}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;text-align:right;color:${s.dueThisWeekCount > 0 ? COLORS.amber : COLORS.text};">${s.dueThisWeekCount}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;text-align:right;color:${COLORS.text};">${s.basDueCount}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;text-align:right;color:${COLORS.text};">${s.payrollDueCount}</td>
    </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;">Staff</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">Overdue</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">Due wk</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">BAS</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">Payroll</td>
    </tr>
    ${rows}
  </table>`;
}

function timesheetTable(data: CombinedReportData): string {
  if (!data.timesheetsAvailable) {
    return `<div style="font-size:13px;color:${COLORS.muted};">Timesheet summary unavailable this week (XPM not connected or no Partner name configured in Settings).</div>`;
  }
  const rows = data.timesheetSummaries
    .map(
      (r) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.text};">${escapeHtml(r.staffName)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;text-align:right;color:${COLORS.text};">${r.priorWeekHours.toFixed(1)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;text-align:right;color:${COLORS.text};">${r.fytdHours.toFixed(1)}</td>
    </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;">Staff</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">Prior week hrs</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">FYTD hrs</td>
    </tr>
    ${rows}
  </table>`;
}

export function renderCombinedReportEmail(data: CombinedReportData): EmailContent {
  const rangeLabel = fmtDateRange(data.window.weekStartIso, data.window.weekEndIso);
  const subject = `Monday Report — Firm summary, week of ${fmtDate(data.window.weekStartIso)} (${data.firmTotals.overdueCount} overdue firm-wide)`;

  const mainTiles = tilesRow([
    { label: "Overdue", value: data.firmTotals.overdueCount, tone: data.firmTotals.overdueCount > 0 ? "red" : "default" },
    { label: "Due this week", value: data.firmTotals.dueThisWeekCount, tone: data.firmTotals.dueThisWeekCount > 0 ? "amber" : "default" },
    { label: "Due later", value: data.firmTotals.dueLaterCount },
  ]);
  const deadlineTiles = tilesRow([
    { label: "BAS/IAS due", value: data.firmTotals.basDueCount, tone: data.firmTotals.basDueCount > 0 ? "amber" : "default" },
    { label: "Payroll due", value: data.firmTotals.payrollDueCount, tone: data.firmTotals.payrollDueCount > 0 ? "amber" : "default" },
  ]);

  const bodyHtml = `
    ${masthead("Monday Report — Firm summary", `Week of ${escapeHtml(rangeLabel)}`, data.window.generatedAtIso)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-top:none;">
      <tr><td style="padding:18px 24px 6px 24px;">${mainTiles}</td></tr>
      <tr><td style="padding:6px 24px 18px 24px;">${deadlineTiles}</td></tr>
    </table>
    ${sectionCard("Top overdue clients (firm-wide)", topOverdueClientsTable(data.topOverdueClients))}
    ${sectionCard("Per-staff summary", staffMiniTable(data))}
    ${sectionCard("Timesheets — prior week &amp; FYTD hours", timesheetTable(data))}
  `;
  const html = htmlShell(`${data.firmTotals.overdueCount} overdue firm-wide`, bodyHtml, FOOTER_TEXT);

  const textLines: string[] = [];
  textLines.push("MONDAY REPORT — FIRM SUMMARY");
  textLines.push(`Week of ${rangeLabel}`);
  textLines.push("");
  textLines.push(`Overdue: ${data.firmTotals.overdueCount}`);
  textLines.push(`Due this week: ${data.firmTotals.dueThisWeekCount}`);
  textLines.push(`Due later: ${data.firmTotals.dueLaterCount}`);
  textLines.push(`BAS/IAS due: ${data.firmTotals.basDueCount}`);
  textLines.push(`Payroll due: ${data.firmTotals.payrollDueCount}`);
  textLines.push("");
  textLines.push("TOP OVERDUE CLIENTS (firm-wide)");
  if (data.topOverdueClients.length === 0) textLines.push("  (no overdue work firm-wide)");
  for (const c of data.topOverdueClients) {
    textLines.push(`  ${c.customerName} — ${c.count} overdue, oldest due ${fmtDate(c.oldestDueDate)}, held by ${c.topStaffName ?? "Unassigned"}`);
  }
  textLines.push("");
  textLines.push("PER-STAFF SUMMARY (overdue / due this week / BAS / payroll)");
  for (const s of data.staffSummaries) {
    textLines.push(`  ${s.staffName}: ${s.overdueCount} / ${s.dueThisWeekCount} / ${s.basDueCount} / ${s.payrollDueCount}`);
  }
  textLines.push("");
  textLines.push("TIMESHEETS — prior week & FYTD hours");
  if (!data.timesheetsAvailable) {
    textLines.push("  (unavailable this week -- XPM not connected or no Partner name configured)");
  } else {
    for (const r of data.timesheetSummaries) {
      textLines.push(`  ${r.staffName}: ${r.priorWeekHours.toFixed(1)}h prior week, ${r.fytdHours.toFixed(1)}h FYTD`);
    }
  }
  textLines.push("");
  textLines.push(`Generated ${fmtGeneratedAt(data.window.generatedAtIso)}`);

  return { subject, html, text: textLines.join("\n") };
}
