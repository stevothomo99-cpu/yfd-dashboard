import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { setCustomerArchived, setCustomerManager } from "@/lib/workflow";

// Admin-only client edits: reassigning a client's Manager (a quick fix
// tool, not synced back to XPM and not protected from the next "Save &
// resync" reverting it -- see setCustomerManager's comment) and archiving/
// unarchiving a client (see setCustomerArchived's comment -- this one IS
// durable across a resync). Body carries whichever of the two fields the
// caller wants to change; either or both may be present.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || (!("managerId" in body) && !("archived" in body))) {
    return NextResponse.json({ error: "managerId and/or archived is required" }, { status: 400 });
  }

  if ("managerId" in body) {
    const managerId = typeof body.managerId === "string" ? body.managerId : null;
    const result = await setCustomerManager(id, managerId);
    if (!result) {
      return NextResponse.json({ error: "Failed to reassign client" }, { status: 500 });
    }
    return NextResponse.json({ customer: result });
  }

  const archived = Boolean(body.archived);
  const result = await setCustomerArchived(id, archived);
  if (!result) {
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
  return NextResponse.json({ customer: result });
}
