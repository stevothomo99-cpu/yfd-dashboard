import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { canModifyTask, combineTasks, getStaffByEmail } from "@/lib/workflow";

// Merges the task at :id into another task, then deletes :id -- see
// lib/workflow.ts's combineTasks for exactly what is/isn't carried over.
// This deletes data, so it gets the same permission check as PATCH/DELETE
// on tasks/[id] rather than the copy route's lighter one -- both the
// duplicate being removed and the task being kept must be within the
// caller's edit scope.
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

  const { id: sourceId } = await params;
  const body = await request.json().catch(() => null);
  const intoTaskId = typeof body?.intoTaskId === "string" ? body.intoTaskId : null;
  if (!intoTaskId) {
    return NextResponse.json({ error: "intoTaskId is required" }, { status: 400 });
  }
  if (intoTaskId === sourceId) {
    return NextResponse.json({ error: "Cannot combine a task with itself" }, { status: 400 });
  }

  if (!isAdmin && staff) {
    const [allowedSource, allowedTarget] = await Promise.all([
      canModifyTask(staff, sourceId),
      canModifyTask(staff, intoTaskId),
    ]);
    if (!allowedSource || !allowedTarget) {
      return NextResponse.json({ error: "You don't have permission to combine these tasks" }, { status: 403 });
    }
  }

  const task = await combineTasks(sourceId, intoTaskId);
  if (!task) {
    return NextResponse.json({ error: "Failed to combine tasks" }, { status: 500 });
  }
  return NextResponse.json({ task });
}
