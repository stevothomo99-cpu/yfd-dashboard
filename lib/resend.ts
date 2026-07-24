import { Resend } from "resend";

// Thin wrapper around the Resend SDK for transactional emails our own
// backend sends directly (e.g. "you've got a new to-do") -- distinct from
// Supabase's SMTP settings, which only cover emails Supabase Auth itself
// sends (password reset, etc.) and have no bearing on anything sent from
// application code. Same Resend account/API key, just a second integration
// point.

let client: Resend | null = null;

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function getResendClient(): Resend {
  if (client) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  client = new Resend(apiKey);
  return client;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Best-effort -- logs and swallows failures rather than throwing, since a
// notification email failing to send should never block the operation that
// triggered it (e.g. a to-do item still gets created even if the "you've
// got a new to-do" email fails).
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!isResendConfigured()) {
    console.error("[resend] RESEND_API_KEY not set -- skipping email:", input.subject);
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    console.error("[resend] RESEND_FROM_EMAIL not set -- skipping email:", input.subject);
    return;
  }

  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    if (error) {
      console.error("[resend] send failed:", error.message);
    }
  } catch (err) {
    console.error("[resend] send threw:", err instanceof Error ? err.message : err);
  }
}
