import { NextRequest, NextResponse } from "next/server";
import { buildReportWindow, buildCombinedReportData, getCombinedReportRecipients } from "@/lib/mondayReport";
import { renderCombinedReportEmail } from "@/lib/emailTemplates/mondayReport";
import { isResendConfigured, sendEmail } from "@/lib/resend";

// Vercel Cron only issues GET requests -- see vercel.json for the schedule
// (Sunday 10:00 UTC = Sunday 20:00 AEST, QLD has no DST). The firm-wide
// overdue summary -- deliberately a night ahead of the Monday-morning
// "Workflow Update" (app/api/reports/monday-report/route.ts) so the Partner
// sees where things stand before the week even starts, not at the same
// moment everyone else gets their own report.
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

  const window = buildReportWindow();
  const resendReady = isResendConfigured();

  const recipients = await getCombinedReportRecipients();
  const results: SendResult[] = [];

  if (recipients.length > 0) {
    try {
      const data = await buildCombinedReportData(window);
      const { subject, html, text } = renderCombinedReportEmail(data);
      for (const partner of recipients) {
        if (!resendReady) {
          console.log(`[overdue-summary] Resend not configured -- would have sent "${subject}" to ${partner.email}`);
          results.push({ name: partner.name, email: partner.email, ok: false, error: "Resend not configured" });
          continue;
        }
        results.push(await sendOne(partner.name, partner.email, subject, text, html));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      for (const partner of recipients) {
        results.push({ name: partner.name, email: partner.email, ok: false, error: message });
      }
    }
  }

  const failed = results.filter((r) => !r.ok);

  return NextResponse.json({
    resendConfigured: resendReady,
    weekOf: window.weekStartIso,
    total: recipients.length,
    sent: results.filter((r) => r.ok).length,
    failed: failed.length,
    failures: failed.map((f) => ({ name: f.name, email: f.email, error: f.error })),
  });
}
