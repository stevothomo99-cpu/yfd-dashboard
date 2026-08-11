// Shared email-client-safe HTML primitives -- table-based layout, inline
// styles only, system font stack, no CSS grid/flexbox/@font-face. Outlook
// (desktop, still Word-rendered) and a lot of mobile mail clients strip
// anything fancier. Originally built for the Monday Report
// (lib/emailTemplates/mondayReport.ts) and extracted here once the
// timesheet reminder emails needed the exact same masthead/tile/section
// language -- two real consumers, not a speculative abstraction.

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export const COLORS = {
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

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function fmtDateRange(startIso: string, endIso: string): string {
  return `${fmtDate(startIso)} – ${fmtDate(endIso)}`;
}

export function fmtGeneratedAt(iso: string): string {
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

export function htmlShell(preheader: string, bodyHtml: string, footerText: string): string {
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
              ${escapeHtml(footerText)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;
}

export function masthead(title: string, subtitle: string, generatedAtIso: string): string {
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

export interface Tile {
  label: string;
  value: number | string;
  tone?: "default" | "red" | "amber";
}

export function tilesRow(tiles: Tile[]): string {
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

export function sectionCard(titleHtml: string, innerHtml: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-top:none;">
    <tr><td style="padding:18px 24px;">
      <div style="font-size:14px;font-weight:700;color:${COLORS.text};margin-bottom:10px;">${titleHtml}</div>
      ${innerHtml}
    </td></tr>
  </table>`;
}
