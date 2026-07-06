import { NextResponse } from "next/server";
import { updateTask, updateTaskStatus, isWorkflowConfigured } from "@/lib/workflow";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isWorkflowConfigured()) {
    return NextResponse.json(
      { message: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set." },
      { status: 503 },
    );
  }
  const { id } = await params;
  const body = await request.json();

  try {
    if (typeof body.statusId === "string") {
      const result = await updateTaskStatus(id, body.statusId);
      return NextResponse.json(result);
    }

    const patch: Parameters<typeof updateTask>[1] = {};
    if (typeof body.title === "string") patch.title = body.title.trim();
    if (typeof body.type === "string") patch.type = body.type.trim();
    if ("assigneeId" in body) patch.assigneeId = typeof body.assigneeId === "string" ? body.assigneeId : null;
    if ("dueDate" in body) patch.dueDate = typeof body.dueDate === "string" ? body.dueDate : null;
    if (typeof body.recurrence === "string") patch.recurrence = body.recurrence;

    const task = await updateTask(id, patch);
    return NextResponse.json({ task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message }, { status: 502 });
  }
}
