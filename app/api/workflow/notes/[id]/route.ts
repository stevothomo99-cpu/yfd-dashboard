import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { setCustomerNotePinned } from "@/lib/workflow";

// Toggles a note's pinned state -- keyed by note id directly (not nested
// under a customer) since that's all this operation needs.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
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
