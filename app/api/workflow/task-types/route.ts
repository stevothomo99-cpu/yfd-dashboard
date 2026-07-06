import { NextResponse } from "next/server";
import { listTaskTypes, createTaskType, isWorkflowConfigured } from "@/lib/workflow";
import { WORKFLOW_TASK_TYPES } from "@/lib/mock";

export async function GET() {
  if (!isWorkflowConfigured()) {
    return NextResponse.json({ taskTypes: WORKFLOW_TASK_TYPES });
  }
  try {
    const taskTypes = await listTaskTypes();
    return NextResponse.json({ taskTypes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ taskTypes: [], message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!isWorkflowConfigured()) {
    return NextResponse.json(
      { message: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set." },
      { status: 503 },
    );
  }
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ message: "Type name is required." }, { status: 400 });
  try {
    const taskType = await createTaskType({
      name,
      color: typeof body.color === "string" ? body.color : "#888780",
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    });
    return NextResponse.json({ taskType }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message }, { status: 502 });
  }
}
