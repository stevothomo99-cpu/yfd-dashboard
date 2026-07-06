import { NextResponse } from "next/server";
import { updateStatus, deleteStatus, isWorkflowConfigured } from "@/lib/workflow";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isWorkflowConfigured()) {
    return NextResponse.json(
      { message: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set." },
      { status: 503 },
    );
  }
  const { id } = await params;
  const body = await request.json();
  const patch: Parameters<typeof updateStatus>[1] = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.color === "string") patch.color = body.color;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;
  if (typeof body.isComplete === "boolean") patch.isComplete = body.isComplete;

  try {
    const status = await updateStatus(id, patch);
    return NextResponse.json({ status });
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
    await deleteStatus(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message }, { status: 409 });
  }
}
