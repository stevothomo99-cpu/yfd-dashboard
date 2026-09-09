import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getNotificationDefinition } from "@/lib/notificationRegistry";

// Renders a real preview of a notification's current template -- the
// "View template" link on Settings -> Notifications opens this directly in
// a new tab. Admin-only: a rendered report can contain real client/staff
// names and figures, same sensitivity as the notification itself.
export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { key } = await params;
  const definition = getNotificationDefinition(key);
  if (!definition) {
    return NextResponse.json({ error: `Unknown notification: ${key}` }, { status: 404 });
  }

  try {
    const { html } = await definition.buildPreview();
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build this preview.";
    return new NextResponse(
      `<div style="font-family:-apple-system,sans-serif;padding:32px;color:#888780;font-size:14px;">${message}</div>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
