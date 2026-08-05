import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncWorkflowFromXpm } from "@/lib/xpmSync";
import { XpmNotConfiguredError } from "@/lib/xpm";

// The sync is inherently many XPM calls -- 8 job-list windows plus the
// client and staff rosters -- and xpmFetch caps concurrency at 4 to stay
// inside Xero's limit, so they can't all overlap. The default timeout is
// too tight for that and cut the sync off mid-flight, which presented as
// the button hanging forever.
export const maxDuration = 300;

// Admin-only trigger for the full-replace staff/customers/jobs sync (see
// lib/xpmSync.ts). This is what the Settings page's "Save & resync" button
// calls, and the only thing that rebuilds these tables.
export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const result = await syncWorkflowFromXpm();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof XpmNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
