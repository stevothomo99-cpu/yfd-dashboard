import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { xpmFetch, isXpmConfigured, xpmJobListDateRange } from "@/lib/xpm";

// Admin-only debug endpoint -- dumps raw XPM API responses so real field
// names can be confirmed against a live tenant, same purpose as
// /api/google/diagnose. job.api/staff.api/client.api are already confirmed
// (see lib/xpm.ts) and dropped from here to keep responses small. Only
// probing time.api/staff/:id now -- its parsing in lib/xpm.ts was written
// blind before XPM was ever connected, and it's still unconfirmed whether
// entries carry a Task reference (needed to tell "YFD - Leave" apart from
// other tasks like "YFD - Idle" within the single internal job). Returns a
// count + one sample entry rather than the full array.
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

  // Andre De Belen -- a manager with a full client book, likely to have
  // logged both client and internal/leave time in the window (Steve
  // Thomas's own timesheet came back empty).
  const SAMPLE_STAFF_ID = "9c4b9c21-0273-433e-9b76-a440fc85b476";

  try {
    const { from, to } = xpmJobListDateRange();
    const raw = await xpmFetch<Record<string, unknown>>(
      `/time.api/staff/${SAMPLE_STAFF_ID}?from=${from}&to=${to}`,
    );
    const entries = Object.values(raw).find((v) => Array.isArray(v)) as unknown[] | undefined;
    return NextResponse.json({
      keys: Object.keys(raw),
      count: entries?.length ?? 0,
      sample: entries?.[0] ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) });
  }
}
