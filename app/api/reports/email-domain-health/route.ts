import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { isResendConfigured, sendEmail } from "@/lib/resend";

// Vercel Cron only issues GET requests -- see vercel.json for the schedule.
//
// Exists because of a real incident: the inbound domain's Resend-side
// verification silently flipped to "Failed" (DNS itself stayed correct the
// whole time -- Resend's own verification check is a separate thing from
// the DNS records resolving) and nobody noticed for roughly six weeks,
// since a dropped inbound email produces no error anyone sees -- it just
// never becomes a To-Do. This polls Resend's own domain status daily and
// emails an alert the moment it's anything other than fully healthy,
// instead of waiting for someone to notice To-Dos have stopped arriving.
export const maxDuration = 30;

// The domain the whole email-to-todo pipeline depends on (see
// app/api/email/inbound/route.ts). Fixed, not configurable -- there's
// exactly one domain this check cares about.
const MONITORED_DOMAIN = "dashboard.yourfinancedept.com.au";
const ALERT_EMAIL = "steve@yourfinancedept.com.au";

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

  const apiKey = process.env.RESEND_INBOUND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_INBOUND_API_KEY is not set" }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.domains.list();
  if (error || !data) {
    const message = error?.message ?? "Failed to list Resend domains";
    await alert(`Could not check Resend domain status: ${message}`, message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }

  const domain = data.data.find((d) => d.name === MONITORED_DOMAIN);
  if (!domain) {
    const message = `Domain "${MONITORED_DOMAIN}" is not in this Resend account's domain list at all.`;
    await alert(message, message);
    return NextResponse.json({ ok: false, domain: null });
  }

  const problems: string[] = [];
  if (domain.status !== "verified") problems.push(`domain status is "${domain.status}" (expected "verified")`);
  if (domain.capabilities.receiving !== "enabled") problems.push("inbound receiving is disabled on this domain");

  if (problems.length > 0) {
    const summary = problems.join("; ");
    await alert(
      `Email-to-To-Do is broken: ${summary}.`,
      `The "${MONITORED_DOMAIN}" domain in Resend is unhealthy: ${summary}. Every email forwarded to todo@${MONITORED_DOMAIN} is silently dropped until this is fixed -- check Resend -> Domains -> ${MONITORED_DOMAIN} and re-verify.`,
    );
  }

  return NextResponse.json({
    ok: problems.length === 0,
    domain: { status: domain.status, capabilities: domain.capabilities },
    problems,
  });
}

// Deliberately re-sends every single day the domain stays unhealthy, rather
// than only once -- a one-off alert that gets missed or archived is exactly
// how the real incident went unnoticed for six weeks. A daily nag until
// someone fixes it is the safer failure mode; it costs one email a day,
// which is nothing next to another silent multi-week outage. Stops on its
// own the moment the domain is healthy again -- no state to track or reset.
async function alert(subject: string, body: string): Promise<void> {
  if (!isResendConfigured()) {
    console.error(`[email-domain-health] Resend not configured -- would have alerted ${ALERT_EMAIL}: ${subject}`);
    return;
  }
  await sendEmail({
    to: ALERT_EMAIL,
    subject: `ALERT: ${subject}`,
    text: body,
    html: `<p>${body}</p>`,
  });
}
