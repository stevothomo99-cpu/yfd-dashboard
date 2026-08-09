import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  canModifyTask,
  deleteTask,
  deleteTaskSeries,
  getClientsInScopeForStaff,
  getStaffByEmail,
  updateTask,
} from "@/lib/workflow";
import type { UpdateTaskInput } from "@/types/workflow";

// Edit and delete for a single task. Admins may touch any task, reassign it
// to any staff member, and move it to any client -- no restriction, same as
// their existing create privileges. Everyone else is scoped by
// canModifyTask: their own tasks (assigned or temporarily-assigned) plus
// anything on their Partner/Manager roll-up board -- see that function's
// comment in lib/workflow.ts for why getWorkBoardForStaff is the right
// source of truth here rather than re-deriving the hierarchy.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";
  const staff = session.user.email ? await getStaffByEmail(session.user.email) : null;
  if (!isAdmin && !staff) {
    return NextResponse.json({ error: "No staff record linked to your login email" }, { status: 403 });
  }

  const { id: taskId } = await params;

  if (!isAdmin && staff) {
    const allowed = await canModifyTask(staff, taskId);
    if (!allowed) {
      return NextResponse.json({ error: "You don't have permission to edit this task" }, { status: 403 });
    }
  }

  try {
    const body = (await request.json()) as Partial<UpdateTaskInput>;

    // A non-admin's broader scope is still bounded to their existing
    // Partner/Manager client scope -- moving a task to a client outside
    // that scope is effectively the same restriction as create's
    // client-scoping rule, so it's checked the same way rather than
    // trusting the client.
    if (!isAdmin && staff && body.customerId !== undefined) {
      const scopedClients = await getClientsInScopeForStaff(staff);
      if (!scopedClients.some((c) => c.id === body.customerId)) {
        return NextResponse.json(
          { error: "You don't have permission to move this task to that client" },
          { status: 403 }
        );
      }
    }

    const patch: UpdateTaskInput = {};
    if (body.customerId !== undefined) patch.customerId = body.customerId;
    if (body.title !== undefined) patch.title = body.title.trim();
    if (body.assigneeId !== undefined) patch.assigneeId = body.assigneeId;
    if (body.dueDate !== undefined) patch.dueDate = body.dueDate;
    if (body.startDate !== undefined) patch.startDate = body.startDate;
    if (body.statusId !== undefined) patch.statusId = body.statusId;
    if (body.typeId !== undefined) patch.typeId = body.typeId;
    if (body.recurrence !== undefined) patch.recurrence = body.recurrence;
    if (body.details !== undefined) patch.details = body.details?.trim() ? body.details.trim() : null;

    if (patch.title !== undefined && !patch.title) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }

    const task = await updateTask(taskId, patch);
    if (!task) {
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    return NextResponse.json({ task });
  } catch (err) {
    console.error("[workflow/tasks/[id]] error updating task:", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";
  const staff = session.user.email ? await getStaffByEmail(session.user.email) : null;
  if (!isAdmin && !staff) {
    return NextResponse.json({ error: "No staff record linked to your login email" }, { status: 403 });
  }

  const { id: taskId } = await params;

  if (!isAdmin && staff) {
    const allowed = await canModifyTask(staff, taskId);
    if (!allowed) {
      return NextResponse.json({ error: "You don't have permission to delete this task" }, { status: 403 });
    }
  }

  // ?scope=series removes every NOT-completed member of the whole recurring
  // series (see lib/workflow.ts's deleteTaskSeries); anything else, or the
  // param absent, deletes just this one occurrence -- today's behaviour,
  // unaffected. Permission is checked once, on the occurrence the caller
  // named -- a series they're allowed to touch here has every living member
  // on the same client, so that one check already covers the whole set.
  const scope = request.nextUrl.searchParams.get("scope");
  const ok = scope === "series" ? await deleteTaskSeries(taskId) : await deleteTask(taskId);
  if (!ok) {
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
