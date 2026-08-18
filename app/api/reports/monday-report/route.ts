import { NextRequest, NextResponse } from "next/server";
import { buildReportWindow, buildStaffReportData, getIndividualReportRecipients, getCombinedReportRecipients } from "@/lib/mondayReport";
import { renderStaffReportEmail } from "@/lib/emailTemplates/mondayReport";
import { isResendConfigured, sendEmail } from "@/lib/resend";

// Vercel Cron only issues GET requests -- see vercel.json for the schedule
// (Sunday 21:00 UTC = Monday 07:00 AEST, QLD has no DST). This is the
// "Workflow Update" -- each person's own overdue/due-this-week/BAS/payroll
// summary. The firm-wide overdue report that used to fire from this same
// route now has its own earlier trigger the night before -- see
// app/api/reports/overdue-summary/route.ts.
//
// Same "whole staff roster, fan-out per person" shape as the timesheet sync,
// so it gets the same generous ceiling.
export const maxDuration = 300;

interface SendResult {
  name: string;
  email: string;
  ok: boolean;
  error?: string;
}

async function sendOne(name: string, email: string, subject: string, text: string, html: string, cc?: string[]): Promise<SendResult> {
  try {
    await sendEmail({ to: email, cc, subject, text, html });
    return { name, email, ok: true };
  } catch (err) {
    // sendEmail itself is best-effort and swallows failures, but this loop
    // still needs a per-recipient pass/fail to report back accurately.
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

  const individualRecipients = await getIndividualReportRecipients();
  // Every included Partner is CC'd on every individual's report -- so
  // whoever's watching the practice sees each person's own Workflow Update
  // as it goes out, not just the separate firm-wide summary. Excludes the
  // recipient themself so a Partner isn't CC'd on their own report.
  const partnerEmails = (await getCombinedReportRecipients()).map((p) => p.email);
  const individualResults: SendResult[] = [];

  for (const staff of individualRecipients) {
    try {
      const data = await buildStaffReportData(staff, window);
      const { subject, html, text } = renderStaffReportEmail(data);
      if (!resendReady) {
        console.log(`[monday-report] Resend not configured -- would have sent "${subject}" to ${staff.email}`);
        individualResults.push({ name: staff.name, email: staff.email, ok: false, error: "Resend not configured" });
        continue;
      }
      const cc = partnerEmails.filter((email) => email !== staff.email);
      individualResults.push(await sendOne(staff.name, staff.email, subject, text, html, cc));
    } catch (err) {
      individualResults.push({
        name: staff.name,
        email: staff.email,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const failed = individualResults.filter((r) => !r.ok);

  return NextResponse.json({
    resendConfigured: resendReady,
    weekOf: window.weekStartIso,
    total: individualRecipients.length,
    sent: individualResults.filter((r) => r.ok).length,
    failed: failed.length,
    failures: failed.map((f) => ({ name: f.name, email: f.email, error: f.error })),
  });
}
