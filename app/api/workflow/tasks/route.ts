import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { createTask } from "@/lib/workflow";
import type { CreateTaskInput } from "@/types/workflow";

// Any authenticated user may create a task (not admin-gated) -- this is the
// XPM-native replacement for Karbon's "New Task" action, wired up from the
// + New Task modal on /my-work.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<CreateTaskInput>;
    const { jobId, title, statusId } = body;

    if (!jobId || !title?.trim() || !statusId) {
      return NextResponse.json(
        { error: "jobId, title, and statusId are required" },
        { status: 400 }
      );
    }

    const task = await createTask({
      jobId,
      title: title.trim(),
      assigneeId: body.assigneeId ?? null,
      dueDate: body.dueDate ?? null,
      startDate: body.startDate ?? null,
      statusId,
      typeId: body.typeId ?? null,
      recurrence: body.recurrence ?? "none",
    });

    if (!task) {
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }

    return NextResponse.json({ task });
  } catch (err) {
    console.error("[workflow/tasks] error creating task:", err);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
