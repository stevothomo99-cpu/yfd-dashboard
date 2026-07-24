import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { getStaffByEmail, getJobsForCustomer } from "@/lib/workflow";
import { getTodoItem, populateTodoItem, markTodoItemDone, discardTodoItem } from "@/lib/todos";
import type { RecurrenceInterval } from "@/types/workflow";

async function resolveActor(): Promise<
  | { ok: true; isAdmin: boolean; staffId: string | null }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const isAdmin = session.user.role === "admin";
  const staff = session.user.email ? await getStaffByEmail(session.user.email) : null;
  if (!isAdmin && !staff) {
    return { ok: false, response: NextResponse.json({ error: "No staff record linked to your login email" }, { status: 403 }) };
  }
  return { ok: true, isAdmin, staffId: staff?.id ?? null };
}

// A to-do is personal -- only its owner or an admin may touch it.
async function requireOwnerOrAdmin(todoId: string) {
  const actor = await resolveActor();
  if (!actor.ok) return actor;

  const todo = await getTodoItem(todoId);
  if (!todo) {
    return { ok: false as const, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  if (!actor.isAdmin && todo.ownerStaffId !== actor.staffId) {
    return { ok: false as const, response: NextResponse.json({ error: "Not your to-do" }, { status: 403 }) };
  }
  return { ok: true as const, todo };
}

interface PatchBody {
  done?: boolean;
  customerId?: string;
  dueDate?: string | null;
  recurrence?: RecurrenceInterval;
  jobId?: string;
}

// Two things this can do, distinguished by which fields are present:
// - { done } -- toggle a populated one-off to-do's completion.
// - { customerId, dueDate, recurrence, jobId? } -- populate a
//   pending_triage item, which either finalizes it as a one-off to-do or
//   converts it into a real Task if recurrence isn't "none" (see
//   lib/todos.ts's populateTodoItem for exactly what "converts" means).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireOwnerOrAdmin(id);
  if (!access.ok) return access.response;

  const body = (await request.json()) as PatchBody;

  if (typeof body.done === "boolean") {
    const todo = await markTodoItemDone(id, body.done);
    if (!todo) return NextResponse.json({ error: "Failed to update to-do" }, { status: 500 });
    return NextResponse.json({ todo });
  }

  if (!body.customerId || !body.recurrence) {
    return NextResponse.json({ error: "customerId and recurrence are required" }, { status: 400 });
  }

  let jobId = body.jobId;
  if (body.recurrence !== "none" && !jobId) {
    const jobs = await getJobsForCustomer(body.customerId);
    if (jobs.length === 1) {
      jobId = jobs[0].id;
    } else {
      return NextResponse.json(
        { error: jobs.length === 0 ? "This client has no jobs to attach a task to." : "This client has more than one job -- choose which one." },
        { status: 400 },
      );
    }
  }

  const result = await populateTodoItem(id, {
    customerId: body.customerId,
    dueDate: body.dueDate ?? null,
    recurrence: body.recurrence,
    jobId,
  });
  if (!result) return NextResponse.json({ error: "Failed to populate to-do" }, { status: 500 });

  return NextResponse.json(
    result.kind === "converted" ? { converted: true, taskId: result.taskId } : { todo: result.todo },
  );
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireOwnerOrAdmin(id);
  if (!access.ok) return access.response;

  const ok = await discardTodoItem(id);
  if (!ok) return NextResponse.json({ error: "Failed to discard to-do" }, { status: 500 });
  return NextResponse.json({ success: true });
}
