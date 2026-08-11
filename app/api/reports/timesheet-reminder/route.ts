import { NextRequest, NextResponse } from "next/server";
import { getSubmitReminderRecipients, buildSubmitReminderData } from "@/lib/timesheetReminders";
import { renderSubmitReminderEmail } from "@/lib/emailTemplates/timesheetReminders";
import { isResendConfigured, sendEmail } from "@/lib/resend";

// Vercel Cron only issues GET requests -- see vercel.json for the schedule
// (Sunday 22:00 UTC = Monday 08:00 AEST, QLD has no DST). "Timesheet
// Reminder #1" -- fires an hour after the Monday Report's "Workflow
// Update" (07:00 AEST) so the two don't compete for the same XPM
// rate-limit budget on the one morning both run.
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
  const recipients = await getSubmitReminderRecipients();
  const results: SendResult[] = [];

  for (const staff of recipients) {
    try {
      const data = buildSubmitReminderData(staff);
      const { subject, html, text } = renderSubmitReminderEmail(data);
      if (!resendReady) {
        console.log(`[timesheet-reminder] Resend not configured -- would have sent "${subject}" to ${staff.email}`);
        results.push({ name: staff.name, email: staff.email, ok: false, error: "Resend not configured" });
        continue;
      }
      results.push(await sendOne(staff.name, staff.email, subject, text, html));
    } catch (err) {
      results.push({
        name: staff.name,
        email: staff.email,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({
    resendConfigured: resendReady,
    total: recipients.length,
    sent: results.filter((r) => r.ok).length,
    failed: failed.length,
    failures: failed.map((f) => ({ name: f.name, email: f.email, error: f.error })),
  });
}
