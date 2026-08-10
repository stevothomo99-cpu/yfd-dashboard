import { NextRequest, NextResponse } from "next/server";
import { buildFollowUpData, getFollowUpSummaryRecipients } from "@/lib/timesheetReminders";
import { renderFollowUpNudgeEmail, renderFollowUpSummaryEmail } from "@/lib/emailTemplates/timesheetReminders";
import { isResendConfigured, sendEmail } from "@/lib/resend";

// Vercel Cron only issues GET requests -- see vercel.json for the schedule
// (Monday 02:00 UTC = Monday 12:00 AEST, QLD has no DST). Individual nudges
// only go to staff still short of a full week; Partners always get the
// summary, even when nobody's short (so "all clear" is visible too, same
// convention as the Monday Report's combined report).
export const maxDuration = 300;

interface SendResult {
  name: string;
  email: string;
  ok: boolean;
  error?: string;
}

async function sendOne(name: string, email: string, subject: string, text: string, html: string): Promise<SendResult> {
  try {
    await sendEmail({ to: email, subject, text, html });
    return { name, email, ok: true };
  } catch (err) {
    return { name, email, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function authorize(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail closed -- no secret configured means no trigger accepted
  const header = request.headers.get("authorization");
  return header === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendReady = isResendConfigured();
  const data = await buildFollowUpData();

  const individualResults: SendResult[] = [];
  for (const row of data.incomplete) {
    try {
      const { subject, html, text } = renderFollowUpNudgeEmail(row, data.priorWeek);
      if (!resendReady) {
        console.log(`[timesheet-followup] Resend not configured -- would have sent "${subject}" to ${row.email}`);
        individualResults.push({ name: row.staffName, email: row.email, ok: false, error: "Resend not configured" });
        continue;
      }
      individualResults.push(await sendOne(row.staffName, row.email, subject, text, html));
    } catch (err) {
      individualResults.push({
        name: row.staffName,
        email: row.email,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const summaryRecipients = await getFollowUpSummaryRecipients();
  const summaryResults: SendResult[] = [];
  if (summaryRecipients.length > 0) {
    try {
      const { subject, html, text } = renderFollowUpSummaryEmail(data);
      for (const partner of summaryRecipients) {
        if (!resendReady) {
          console.log(`[timesheet-followup] Resend not configured -- would have sent "${subject}" to ${partner.email}`);
          summaryResults.push({ name: partner.name, email: partner.email, ok: false, error: "Resend not configured" });
          continue;
        }
        summaryResults.push(await sendOne(partner.name, partner.email, subject, text, html));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      for (const partner of summaryRecipients) {
        summaryResults.push({ name: partner.name, email: partner.email, ok: false, error: message });
      }
    }
  }

  const allResults = [...individualResults, ...summaryResults];
  const failed = allResults.filter((r) => !r.ok);

  return NextResponse.json({
    resendConfigured: resendReady,
    weekOf: data.priorWeek.startIso,
    timesheetsAvailable: data.timesheetsAvailable,
    unavailableReason: data.unavailableReason,
    incomplete: { total: data.incomplete.length, sent: individualResults.filter((r) => r.ok).length },
    summary: { total: summaryRecipients.length, sent: summaryResults.filter((r) => r.ok).length },
    sent: allResults.filter((r) => r.ok).length,
    failed: failed.length,
    failures: failed.map((f) => ({ name: f.name, email: f.email, error: f.error })),
  });
}
