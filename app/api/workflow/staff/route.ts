import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { listStaff, setStaffIncluded } from "@/lib/workflow";

// The include/exclude toggle behind Settings → Included staff. Practice-wide
// state, so admin-only: an excluded person disappears from the Timesheets
// figures everyone else is measured against.
async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const staff = await listStaff();
  return NextResponse.json({
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      included: s.included,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = input as { staffId?: unknown; included?: unknown };
  if (typeof body.staffId !== "string" || !body.staffId) {
    return NextResponse.json({ error: "staffId is required." }, { status: 400 });
  }
  if (typeof body.included !== "boolean") {
    return NextResponse.json({ error: "included must be a boolean." }, { status: 400 });
  }

  // Checked against the roster rather than trusted, so a bad id fails loudly
  // instead of updating nothing and reporting success.
  const staff = await listStaff();
  const target = staff.find((s) => s.id === body.staffId);
  if (!target) {
    return NextResponse.json({ error: "No such staff member." }, { status: 404 });
  }

  try {
    await setStaffIncluded(target.id, body.included);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ id: target.id, included: body.included });
}
