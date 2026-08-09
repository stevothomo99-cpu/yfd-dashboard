import type {
  ClientOverdueGroup,
  CombinedReportData,
  StaffReportData,
  TaskLine,
} from "@/lib/mondayReport";

// Email-client-safe HTML for the weekly Monday Report -- table-based layout,
// inline styles only, system font stack, no CSS grid/flexbox/@font-face.
// Outlook (desktop, still Word-rendered) and a lot of mobile mail clients
// strip anything fancier, so this deliberately reproduces the approved
// prototype's tile/list language with plain tables rather than its original
// CSS.

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const COLORS = {
  bg: "#f4f3f0",
  card: "#ffffff",
  border: "#e3e1db",
  text: "#26241f",
  muted: "#6b6860",
  red: "#b3271e",
  redBg: "#fbeae9",
  amber: "#a3620a",
  amberBg: "#fdf2e1",
  accent: "#1f5c4c",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
}

function fmtDateRange(startIso: string, endIso: string): string {
  return `${fmtDate(startIso)} – ${fmtDate(endIso)}`;
}

function fmtGeneratedAt(iso: string): string {
  return (
    new Date(iso).toLocaleString("en-AU", {
      timeZone: "Australia/Brisbane",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }) + " AEST"
  );
}

function htmlShell(preheader: string, bodyHtml: string): string {
  return `<!--[if mso]><style>table {border-collapse: collapse;}</style><![endif]-->
<body style="margin:0;padding:0;background-color:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;">
          <tr><td>${bodyHtml}</td></tr>
          <tr>
            <td style="padding:16px 8px;color:${COLORS.muted};font-size:12px;line-height:1.5;">
              YFD Dashboard — automated Monday Report. Generated from live workflow data; if a
              number looks off, check the dashboard directly before assuming the email is stale.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;
}

function masthead(title: string, subtitle: string, generatedAtIso: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.accent};border-radius:8px 8px 0 0;">
    <tr>
      <td style="padding:20px 24px;">
        <div style="color:#ffffff;font-size:20px;font-weight:700;">${escapeHtml(title)}</div>
        <div style="color:#d9ece5;font-size:13px;margin-top:4px;">${escapeHtml(subtitle)}</div>
        <div style="color:#a9d2c4;font-size:11px;margin-top:8px;">Generated ${escapeHtml(fmtGeneratedAt(generatedAtIso))}</div>
      </td>
    </tr>
  </table>`;
}

interface Tile {
  label: string;
  value: number;
  tone?: "default" | "red" | "amber";
}

function tilesRow(tiles: Tile[]): string {
  const cellWidth = Math.floor(100 / tiles.length);
  const cells = tiles
    .map((tile) => {
      const bg = tile.tone === "red" ? COLORS.redBg : tile.tone === "amber" ? COLORS.amberBg : COLORS.card;
      const valueColor = tile.tone === "red" ? COLORS.red : tile.tone === "amber" ? COLORS.amber : COLORS.text;
      return `<td width="${cellWidth}%" style="padding:4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bg};border:1px solid ${COLORS.border};border-radius:6px;">
          <tr><td style="padding:14px 10px;text-align:center;">
            <div style="font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;color:${valueColor};">${tile.value}</div>
            <div style="font-size:11px;color:${COLORS.muted};margin-top:2px;text-transform:uppercase;letter-spacing:0.03em;">${escapeHtml(tile.label)}</div>
          </tr></td>
        </table>
      </td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`;
}

function sectionCard(titleHtml: string, innerHtml: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-top:none;">
    <tr><td style="padding:18px 24px;">
      <div style="font-size:14px;font-weight:700;color:${COLORS.text};margin-bottom:10px;">${titleHtml}</div>
      ${innerHtml}
    </td></tr>
  </table>`;
}

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

function overdueByClientTable(groups: ClientOverdueGroup[]): string {
  if (groups.length === 0) {
    return `<div style="font-size:13px;color:${COLORS.muted};">No overdue work — nice.</div>`;
  }
  const blocks = groups
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
  return blocks;
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
  const html = htmlShell(`${data.overdueCount} overdue, ${data.dueThisWeekCount} due this week`, bodyHtml);

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
    ${sectionCard("Per-staff summary", staffMiniTable(data))}
    ${sectionCard("Timesheets — prior week &amp; FYTD hours", timesheetTable(data))}
  `;
  const html = htmlShell(`${data.firmTotals.overdueCount} overdue firm-wide`, bodyHtml);

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
