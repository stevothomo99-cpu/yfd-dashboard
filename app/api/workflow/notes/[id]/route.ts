import { NextResponse, NextRequest } from "next/server";
import { getCustomerIdForNote, setCustomerNotePinned } from "@/lib/workflow";
import { authorizeClientAccess } from "@/lib/routeAuth";

// Toggles a note's pinned state -- keyed by note id directly (not nested
// under a customer), so the scope check has to resolve which client the
// note belongs to first (see getCustomerIdForNote) before confirming the
// caller has access to that client.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const customerId = await getCustomerIdForNote(id);
  if (!customerId) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
  const authz = await authorizeClientAccess(customerId);
  if (authz instanceof NextResponse) return authz;

  const body = (await request.json()) as { pinned?: boolean };
  if (typeof body.pinned !== "boolean") {
    return NextResponse.json({ error: "pinned (boolean) is required" }, { status: 400 });
  }

  const note = await setCustomerNotePinned(id, body.pinned);
  if (!note) {
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
  return NextResponse.json({ note });
}
