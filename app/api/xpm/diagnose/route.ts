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

  // Steve Thomas's own uuid (confirmed via staffList) -- a real staff
  // member likely to have logged both client and internal/leave time.
  // time.api/staff/:id parsing was written blind before XPM was connected
  // at all, so its shape (including whether entries carry a Task
  // reference, needed to tell "YFD - Leave" apart from other internal
  // tasks like "YFD - Idle") has never been confirmed.
  try {
    const { from, to } = xpmJobListDateRange();
    results.timeSample = await xpmFetch(
      `/time.api/staff/07e5d4c3-e957-4741-9fbe-d7d94eaf045a?from=${from}&to=${to}`,
    );
  } catch (err) {
    results.timeSample = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json(results);
}
