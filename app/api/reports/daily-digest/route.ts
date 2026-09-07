import { NextRequest, NextResponse } from "next/server";
import { buildDailyDigestData, getDailyDigestRecipients, type DailyDigestData } from "@/lib/dailyDigest";
import { aestTodayIso } from "@/lib/mondayReport";
import { renderDailyDigestEmail } from "@/lib/emailTemplates/dailyDigest";
import { isResendConfigured, sendEmail } from "@/lib/resend";

// Vercel Cron only issues GET requests -- see vercel.json for the schedule
// (UTC Mon-Sat 21:00 = AEST Tue-Sun 07:00, QLD has no DST). Deliberately
// does NOT include Sunday-UTC/Monday-AEST -- that morning's fuller
// "Workflow Update" (app/api/reports/monday-report/route.ts) already covers
// overdue + due-today as part of its weekly report, so a second email at
// the same moment would just be a duplicate. A lighter, every-other-morning
// version of that report: just overdue + due today, to every included
// staff member.
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

  const todayIso = aestTodayIso();
  const resendReady = isResendConfigured();

  const recipients = await getDailyDigestRecipients();
  const results: SendResult[] = [];

  for (const staff of recipients) {
    try {
      const data: DailyDigestData = await buildDailyDigestData(staff, todayIso);
      const { subject, html, text } = renderDailyDigestEmail(data);
      if (!resendReady) {
        console.log(`[daily-digest] Resend not configured -- would have sent "${subject}" to ${staff.email}`);
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
    date: todayIso,
    total: recipients.length,
    sent: results.filter((r) => r.ok).length,
    failed: failed.length,
    failures: failed.map((f) => ({ name: f.name, email: f.email, error: f.error })),
  });
}
