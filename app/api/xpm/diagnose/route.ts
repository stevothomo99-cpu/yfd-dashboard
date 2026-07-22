import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { xpmFetch, isXpmConfigured } from "@/lib/xpm";

// Admin-only debug endpoint -- dumps raw XPM API responses so real field
// names can be confirmed against a live tenant before the staff/customers/
// jobs sync is written, same purpose as /api/google/diagnose. The existing
// XpmJob type only ever parsed Partner/Manager/Client sub-objects, never a
// job's own UUID/Name, and there's no confirmed staff.api/list endpoint
// (only staff.api/get/:id, used one ID at a time) -- this route exists to
// resolve both before writing code that guesses.
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
    results.jobList = await xpmFetch("/job.api/list?status=InProgress");
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
