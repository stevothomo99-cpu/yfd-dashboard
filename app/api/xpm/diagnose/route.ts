import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { xpmFetch, isXpmConfigured, xpmJobListDateRange } from "@/lib/xpm";

// Admin-only debug endpoint -- dumps raw XPM API responses so real field
// names can be confirmed against a live tenant before the staff/customers/
// jobs sync is written, same purpose as /api/google/diagnose. Probing
// client.api/list now too: clients carry their own Partner/Manager fields
// directly (confirmed via the XPM UI), which should let the sync filter
// clients by their own partner instead of deriving clients from a
// date-windowed job list.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (!isXpmConfigured()) {
    return NextResponse.json(
      { error: "XPM env vars are not fully set (check XPM_CLIENT_ID/SECRET/REFRESH_TOKEN/TENANT_ID)." },
      { status: 400 },
    );
  }

  const results: Record<string, unknown> = {};

  try {
    const { from, to } = xpmJobListDateRange();
    results.jobList = await xpmFetch(`/job.api/list?status=InProgress&from=${from}&to=${to}`);
  } catch (err) {
    results.jobList = { error: err instanceof Error ? err.message : String(err) };
  }

  try {
    results.staffList = await xpmFetch("/staff.api/list");
  } catch (err) {
    results.staffList = { error: err instanceof Error ? err.message : String(err) };
  }

  try {
    results.clientList = await xpmFetch("/client.api/list");
  } catch (err) {
    results.clientList = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json(results);
}
