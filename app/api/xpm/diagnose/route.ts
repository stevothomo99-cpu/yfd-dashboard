import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { xpmFetch, isXpmConfigured, xpmJobListDateRange } from "@/lib/xpm";

// Admin-only debug endpoint -- dumps raw XPM API responses so real field
// names can be confirmed against a live tenant before the staff/customers/
// jobs sync is written, same purpose as /api/google/diagnose. Confirmed so
// far: staff.api/list works and returns the full real staff roster (no
// Partner/Manager/Staff role field on it, though -- role has to be
// inferred from job assignments); job.api/list needed a Xero-Features
// header fix plus from/to params under a year. Still unconfirmed: a job's
// own identifying fields (UUID/Name), since parsing never captured them.
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

  return NextResponse.json(results);
}
