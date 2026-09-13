import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { setCustomerManager } from "@/lib/workflow";

// Admin-only reassignment of a client's Manager -- a quick fix tool, not
// synced back to XPM and not protected from the next "Save & resync"
// reverting it (see setCustomerManager's comment).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !("managerId" in body)) {
    return NextResponse.json({ error: "managerId is required (null to unassign)" }, { status: 400 });
  }
  const managerId = typeof body.managerId === "string" ? body.managerId : null;

  const result = await setCustomerManager(id, managerId);
  if (!result) {
    return NextResponse.json({ error: "Failed to reassign client" }, { status: 500 });
  }
  return NextResponse.json({ customer: result });
}
