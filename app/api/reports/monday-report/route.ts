import { NextRequest, NextResponse } from "next/server";
import {
  buildReportWindow,
  buildCombinedReportData,
  buildStaffReportData,
  getCombinedReportRecipients,
  getIndividualReportRecipients,
} from "@/lib/mondayReport";
import { renderCombinedReportEmail, renderStaffReportEmail } from "@/lib/emailTemplates/mondayReport";
import { isResendConfigured, sendEmail } from "@/lib/resend";

// Vercel Cron only issues GET requests -- see vercel.json for the schedule
// (Sunday 20:00 UTC = Monday 06:00 AEST, QLD has no DST).
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

async function sendOne(name: string, email: string, subject: string, text: string, html: string): Promise<SendResult> {
  try {
    await sendEmail({ to: email, subject, text, html });
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
      individualResults.push(await sendOne(staff.name, staff.email, subject, text, html));
    } catch (err) {
      individualResults.push({
        name: staff.name,
        email: staff.email,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const combinedRecipients = await getCombinedReportRecipients();
  const combinedResults: SendResult[] = [];

  if (combinedRecipients.length > 0) {
    try {
      const combinedData = await buildCombinedReportData(window);
      const { subject, html, text } = renderCombinedReportEmail(combinedData);
      for (const partner of combinedRecipients) {
        if (!resendReady) {
          console.log(`[monday-report] Resend not configured -- would have sent "${subject}" to ${partner.email}`);
          combinedResults.push({ name: partner.name, email: partner.email, ok: false, error: "Resend not configured" });
          continue;
        }
        combinedResults.push(await sendOne(partner.name, partner.email, subject, text, html));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      for (const partner of combinedRecipients) {
        combinedResults.push({ name: partner.name, email: partner.email, ok: false, error: message });
      }
    }
  }

  const allResults = [...individualResults, ...combinedResults];
  const sent = allResults.filter((r) => r.ok).length;
  const failed = allResults.filter((r) => !r.ok);

  return NextResponse.json({
    resendConfigured: resendReady,
    weekOf: window.weekStartIso,
    individual: { total: individualRecipients.length, sent: individualResults.filter((r) => r.ok).length },
    combined: { total: combinedRecipients.length, sent: combinedResults.filter((r) => r.ok).length },
    sent,
    failed: failed.length,
    failures: failed.map((f) => ({ name: f.name, email: f.email, error: f.error })),
  });
}
