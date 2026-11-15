import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { applyTemplateToClient, canAccessClient, getStaffByEmail } from "@/lib/workflow";

// Bulk-creates fresh tasks on a destination client from a saved template's
// items -- see lib/workflow.ts's applyTemplateToClient for exactly what
// is/isn't carried over. Same scoping as a plain task create: admins
// unrestricted, everyone else needs canAccessClient on the destination.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";
  const staff = session.user.email ? await getStaffByEmail(session.user.email) : null;
  if (!isAdmin && !staff) {
    return NextResponse.json({ error: "No staff record linked to your login email" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as { customerId?: string };
  const customerId = body.customerId?.trim();
  if (!customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }

  if (!isAdmin && staff) {
    if (!(await canAccessClient(staff, customerId))) {
      return NextResponse.json(
        { error: "You don't have permission to apply a template to that client" },
        { status: 403 }
      );
    }
  }

  const result = await applyTemplateToClient(id, customerId);
  if (!result) {
    return NextResponse.json({ error: "Failed to apply template" }, { status: 500 });
  }
  return NextResponse.json(result);
}
