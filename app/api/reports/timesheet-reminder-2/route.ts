import { NextRequest, NextResponse } from "next/server";
import { buildFollowUpData } from "@/lib/timesheetReminders";
import { renderFollowUpNudgeEmail } from "@/lib/emailTemplates/timesheetReminders";
import { isResendConfigured, sendEmail } from "@/lib/resend";

// Vercel Cron only issues GET requests -- see vercel.json for the schedule
// (Monday 00:00 UTC = Monday 10:00 AEST, QLD has no DST). "Timesheet
// Reminder #2" -- a second, harder nudge for whoever's still short of last
// week's standard hours, between the morning "please submit" ask
// (timesheet-reminder, 08:00 AEST) and the midday round
// (timesheet-followup, 12:00 AEST) that adds the whole-FY shortfall email
// and the Partner-facing summary. Only people still short get this one.
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

  const results: SendResult[] = [];
  for (const row of data.incomplete) {
    try {
      const { subject, html, text } = renderFollowUpNudgeEmail(row, data.priorWeek);
      if (!resendReady) {
        console.log(`[timesheet-reminder-2] Resend not configured -- would have sent "${subject}" to ${row.email}`);
        results.push({ name: row.staffName, email: row.email, ok: false, error: "Resend not configured" });
        continue;
      }
      results.push(await sendOne(row.staffName, row.email, subject, text, html));
    } catch (err) {
      results.push({
        name: row.staffName,
        email: row.email,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const failed = results.filter((r) => !r.ok);

  return NextResponse.json({
    resendConfigured: resendReady,
    weekOf: data.priorWeek.startIso,
    timesheetsAvailable: data.timesheetsAvailable,
    unavailableReason: data.unavailableReason,
    total: data.incomplete.length,
    sent: results.filter((r) => r.ok).length,
    failed: failed.length,
    failures: failed.map((f) => ({ name: f.name, email: f.email, error: f.error })),
  });
}
