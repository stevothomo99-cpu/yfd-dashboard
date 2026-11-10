import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { canAccessClient, canModifyTask, copyTaskToClient, getStaffByEmail } from "@/lib/workflow";

// Copies an existing task onto a (usually different) client -- see
// lib/workflow.ts's copyTaskToClient for exactly what is/isn't carried
// over. Admins may copy any task to any client, same as their existing
// edit/create privileges; everyone else needs permission on BOTH ends --
// canModifyTask on the source task (same check PATCH/DELETE use) and
// canAccessClient on the destination, since a copy is really a create on
// that client in disguise.
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
    if (!(await canModifyTask(staff, id))) {
      return NextResponse.json({ error: "You don't have permission to copy this task" }, { status: 403 });
    }
    if (!(await canAccessClient(staff, customerId))) {
      return NextResponse.json({ error: "You don't have permission to copy to that client" }, { status: 403 });
    }
  }

  const task = await copyTaskToClient(id, customerId);
  if (!task) {
    return NextResponse.json({ error: "Failed to copy task" }, { status: 500 });
  }
  return NextResponse.json({ task });
}
