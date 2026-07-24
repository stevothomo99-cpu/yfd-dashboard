import { NextResponse, NextRequest } from "next/server";
import { Resend } from "resend";
import { createTodoItem, resolveTodoOwners } from "@/lib/todos";
import { sendEmail } from "@/lib/resend";

// Public webhook (Resend can't authenticate as one of our users) --
// verified via Resend's own signature instead of a session, the same way
// any inbound webhook must prove it's genuinely from the provider rather
// than an arbitrary POST. Must read the RAW body for verification; parsing
// as JSON first breaks the signature check.
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  const sharedInboxAddress = process.env.TODO_INBOUND_EMAIL;

  if (!webhookSecret || !apiKey || !sharedInboxAddress) {
    console.error("[email/inbound] RESEND_WEBHOOK_SECRET/RESEND_API_KEY/TODO_INBOUND_EMAIL not fully set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const resend = new Resend(apiKey);

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
  }

  let event;
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret,
    });
  } catch (err) {
    console.error("[email/inbound] signature verification failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type !== "email.received") {
    // Not an inbound-email event (e.g. a delivery/bounce event if this
    // endpoint ever gets subscribed to more than just email.received) --
    // acknowledge without acting on it.
    return NextResponse.json({ ok: true });
  }

  const { email_id, from, to, cc, subject } = event.data;

  const owners = await resolveTodoOwners(to, cc ?? [], from, sharedInboxAddress);
  if (owners.length === 0) {
    console.error(
      `[email/inbound] no staff match for email ${email_id} (from=${from}, to=${to.join(",")}, cc=${(cc ?? []).join(",")})`,
    );
    return NextResponse.json({ ok: true }); // ack anyway -- nothing more we can do with an unmatched sender
  }

  // The webhook payload itself is metadata-only (no body) -- fetch the full
  // message for the text content.
  let bodyText: string | null = null;
  try {
    const full = await resend.emails.receiving.get(email_id);
    bodyText = full.data?.text ?? null;
  } catch (err) {
    console.error("[email/inbound] failed to fetch full email body:", err instanceof Error ? err.message : err);
  }

  const fromNameMatch = from.match(/^"?([^"<]*)"?\s*<.*>$/);
  const createdByName = fromNameMatch?.[1]?.trim() || null;
  const fromEmailMatch = from.match(/<(.+)>/);
  const createdByEmail = fromEmailMatch?.[1]?.trim() ?? from;

  const siteUrl = process.env.AUTH_URL ?? request.nextUrl.origin;

  for (const owner of owners) {
    // sourceEmailId is the same for every owner in a multi-recipient
    // delegation, but source_email_id is UNIQUE per row -- only the first
    // insert would carry it, so only that owner's item is dedupe-protected
    // against a retried webhook delivery. Acceptable trade-off: a retry
    // duplicating a delegated to-do for the 2nd+ recipient is far rarer and
    // far less harmful than under-delivering the 1st.
    const todo = await createTodoItem({
      ownerStaffId: owner.id,
      createdByEmail,
      createdByName,
      subject: subject || "(no subject)",
      body: bodyText,
      sourceEmailId: owners[0].id === owner.id ? email_id : null,
    });

    if (todo) {
      await sendEmail({
        to: owner.email,
        subject: `New to-do: ${todo.subject}`,
        text:
          `Hi ${owner.name.split(" ")[0]},\n\n` +
          (createdByName && createdByName !== owner.name
            ? `${createdByName} forwarded you a new to-do:\n\n`
            : `A new to-do landed from a forwarded email:\n\n`) +
          `"${todo.subject}"\n\n` +
          `Go fill in the client and due date: ${siteUrl}/dashboard`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
