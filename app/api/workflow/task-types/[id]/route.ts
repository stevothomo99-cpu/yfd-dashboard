import { NextResponse } from "next/server";
import { updateTaskType, deleteTaskType, isWorkflowConfigured } from "@/lib/workflow";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isWorkflowConfigured()) {
    return NextResponse.json(
      { message: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set." },
      { status: 503 },
    );
  }
  const { id } = await params;
  const body = await request.json();
  const patch: Parameters<typeof updateTaskType>[1] = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.color === "string") patch.color = body.color;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;

  try {
    const taskType = await updateTaskType(id, patch);
    return NextResponse.json({ taskType });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isWorkflowConfigured()) {
    return NextResponse.json(
      { message: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set." },
      { status: 503 },
    );
  }
  const { id } = await params;
  try {
    await deleteTaskType(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message }, { status: 409 });
  }
}
