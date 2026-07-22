import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncWorkflowFromXpm } from "@/lib/xpmSync";
import { XpmNotConfiguredError } from "@/lib/xpm";

// Admin-only trigger for the full-replace staff/customers/jobs sync (see
// lib/xpmSync.ts) -- separate from /api/xpm/staff, which only feeds the
// legacy Karbon<->XPM staff-linking widget and never touches these tables.
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
