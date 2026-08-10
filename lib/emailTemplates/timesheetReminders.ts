import type { FollowUpData, PriorWeek, SubmitReminderData, TimesheetStatusRow } from "@/lib/timesheetReminders";
import { COLORS, escapeHtml, fmtDateRange, fmtGeneratedAt, htmlShell, masthead, sectionCard, tilesRow } from "./shared";
import type { EmailContent } from "./shared";

// Timesheet submission reminder emails -- same shared HTML primitives as
// the Monday Report (./shared), table-based/inline-styles-only for the same
// Outlook/mobile-mail-client reasons.

const FOOTER_TEXT =
  "YFD Dashboard — automated timesheet reminder. Generated from live XPM timesheet data; if a number looks off, check /timesheets directly before assuming the email is stale.";

function hoursShort(row: TimesheetStatusRow): number {
  return Math.max(0, row.standardHours - row.loggedHours);
}

// ── Monday-morning "please submit" reminder ────────────────────────────

export function renderSubmitReminderEmail(data: SubmitReminderData): EmailContent {
  const firstName = data.staff.name.split(" ")[0];
  const rangeLabel = fmtDateRange(data.priorWeek.startIso, data.priorWeek.endIso);
  const generatedAtIso = new Date().toISOString();
  const subject = `Timesheet reminder — please submit for the week of ${rangeLabel}`;

  const bodyHtml = `
    ${masthead("Timesheet reminder", `Week of ${escapeHtml(rangeLabel)}`, generatedAtIso)}
    ${sectionCard(
      "Please submit your timesheet",
      `<div style="font-size:13px;color:${COLORS.text};line-height:1.6;">
        Hi ${escapeHtml(firstName)}, this is a reminder to log your hours in XPM for last week
        (${escapeHtml(rangeLabel)}) if you haven't already. If you're already up to date, no action needed.
      </div>`,
    )}
  `;
  const html = htmlShell(`Please submit your timesheet for ${rangeLabel}`, bodyHtml, FOOTER_TEXT);

  const text = [
    "TIMESHEET REMINDER",
    `Week of ${rangeLabel}`,
    "",
    `Hi ${firstName}, this is a reminder to log your hours in XPM for last week (${rangeLabel}) if you haven't already.`,
    "",
    `Generated ${fmtGeneratedAt(generatedAtIso)}`,
  ].join("\n");

  return { subject, html, text };
}

// ── Midday personal follow-up (only sent to staff still short) ────────

export function renderFollowUpNudgeEmail(row: TimesheetStatusRow, priorWeek: PriorWeek): EmailContent {
  const firstName = row.staffName.split(" ")[0];
  const rangeLabel = fmtDateRange(priorWeek.startIso, priorWeek.endIso);
  const generatedAtIso = new Date().toISOString();
  const short = hoursShort(row);
  const subject = `Timesheet follow-up — ${row.loggedHours.toFixed(1)}/${row.standardHours.toFixed(1)} hrs logged for ${rangeLabel}`;

  const tiles = tilesRow([
    { label: "Logged", value: row.loggedHours.toFixed(1) },
    { label: "Standard", value: row.standardHours.toFixed(1) },
    { label: "Still short", value: short.toFixed(1), tone: "amber" },
  ]);

  const bodyHtml = `
    ${masthead("Timesheet follow-up", `Week of ${escapeHtml(rangeLabel)}`, generatedAtIso)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-top:none;">
      <tr><td style="padding:18px 24px;">${tiles}</td></tr>
    </table>
    ${sectionCard(
      "Still open",
      `<div style="font-size:13px;color:${COLORS.text};line-height:1.6;">
        Hi ${escapeHtml(firstName)}, as of midday you're still ${short.toFixed(1)} hour${short === 1 ? "" : "s"} short
        of a full week (${row.standardHours.toFixed(1)} hrs) for ${escapeHtml(rangeLabel)}. Please complete your
        timesheet in XPM as soon as you can.
      </div>`,
    )}
  `;
  const html = htmlShell(`Still ${short.toFixed(1)} hrs short for ${rangeLabel}`, bodyHtml, FOOTER_TEXT);

  const text = [
    "TIMESHEET FOLLOW-UP",
    `Week of ${rangeLabel}`,
    "",
    `Logged: ${row.loggedHours.toFixed(1)} hrs`,
    `Standard: ${row.standardHours.toFixed(1)} hrs`,
    `Still short: ${short.toFixed(1)} hrs`,
    "",
    `Hi ${firstName}, as of midday you're still short of a full week for ${rangeLabel}. Please complete your timesheet in XPM.`,
    "",
    `Generated ${fmtGeneratedAt(generatedAtIso)}`,
  ].join("\n");

  return { subject, html, text };
}

// ── Midday Partner summary ─────────────────────────────────────────────

function incompleteTable(rows: TimesheetStatusRow[]): string {
  if (rows.length === 0) {
    return `<div style="font-size:13px;color:${COLORS.muted};">Everyone's logged a full week — nice.</div>`;
  }
  const body = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.text};">${escapeHtml(r.staffName)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;text-align:right;color:${COLORS.text};">${r.loggedHours.toFixed(1)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;text-align:right;color:${COLORS.text};">${r.standardHours.toFixed(1)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;text-align:right;color:${COLORS.amber};font-weight:600;">${hoursShort(r).toFixed(1)}</td>
    </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;">Staff</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">Logged</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">Standard</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">Short</td>
    </tr>
    ${body}
  </table>`;
}

function fytdBillableTable(data: FollowUpData): string {
  if (!data.timesheetsAvailable) {
    return `<div style="font-size:13px;color:${COLORS.muted};">${escapeHtml(
      data.unavailableReason ?? "Unavailable this week.",
    )}</div>`;
  }
  if (data.fytdBillable.length === 0) {
    return `<div style="font-size:13px;color:${COLORS.muted};">No staff linked to an XPM record yet.</div>`;
  }
  const body = data.fytdBillable
    .map(
      (r) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.text};">${escapeHtml(r.staffName)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;text-align:right;color:${COLORS.text};">${r.fytdHours.toFixed(1)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${COLORS.border};font-size:13px;font-variant-numeric:tabular-nums;text-align:right;color:${COLORS.text};font-weight:600;">${r.fytdBillableCapacityPct !== null ? `${r.fytdBillableCapacityPct}%` : "—"}</td>
    </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;">Staff</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">FYTD hrs (billable)</td>
      <td style="padding:4px 8px;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;text-align:right;">FYTD billable %</td>
    </tr>
    ${body}
  </table>`;
}

export function renderFollowUpSummaryEmail(data: FollowUpData): EmailContent {
  const rangeLabel = fmtDateRange(data.priorWeek.startIso, data.priorWeek.endIso);
  const generatedAtIso = new Date().toISOString();
  const subject = `Timesheet follow-up — Firm summary, week of ${rangeLabel} (${data.incomplete.length} still incomplete)`;

  const tiles = tilesRow([
    { label: "Still incomplete", value: data.incomplete.length, tone: data.incomplete.length > 0 ? "amber" : "default" },
  ]);

  const bodyHtml = `
    ${masthead("Timesheet follow-up — Firm summary", `Week of ${escapeHtml(rangeLabel)}`, generatedAtIso)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-top:none;">
      <tr><td style="padding:18px 24px;">${tiles}</td></tr>
    </table>
    ${sectionCard(`Last week (${escapeHtml(rangeLabel)}) — still incomplete`, incompleteTable(data.incomplete))}
    ${sectionCard("YTD billable overview (against capacity, Partners excluded)", fytdBillableTable(data))}
  `;
  const html = htmlShell(`${data.incomplete.length} still incomplete for ${rangeLabel}`, bodyHtml, FOOTER_TEXT);

  const textLines: string[] = [];
  textLines.push("TIMESHEET FOLLOW-UP — FIRM SUMMARY");
  textLines.push(`Week of ${rangeLabel}`);
  textLines.push("");
  textLines.push(`Still incomplete: ${data.incomplete.length}`);
  textLines.push("");
  textLines.push(`LAST WEEK (${rangeLabel}) — STILL INCOMPLETE`);
  if (data.incomplete.length === 0) textLines.push("  (everyone's logged a full week)");
  for (const r of data.incomplete) {
    textLines.push(`  ${r.staffName}: ${r.loggedHours.toFixed(1)}/${r.standardHours.toFixed(1)} hrs, ${hoursShort(r).toFixed(1)} short`);
  }
  textLines.push("");
  textLines.push("YTD BILLABLE OVERVIEW (against capacity, Partners excluded)");
  if (!data.timesheetsAvailable) {
    textLines.push(`  (${data.unavailableReason ?? "unavailable"})`);
  } else if (data.fytdBillable.length === 0) {
    textLines.push("  (no staff linked to an XPM record yet)");
  } else {
    for (const r of data.fytdBillable) {
      textLines.push(`  ${r.staffName}: ${r.fytdBillableCapacityPct !== null ? `${r.fytdBillableCapacityPct}%` : "—"} (${r.fytdHours.toFixed(1)} hrs FYTD)`);
    }
  }
  textLines.push("");
  textLines.push(`Generated ${fmtGeneratedAt(generatedAtIso)}`);

  return { subject, html, text: textLines.join("\n") };
}
