import { NextResponse } from "next/server";
import { listTaskViews, createTask, isWorkflowConfigured } from "@/lib/workflow";
import { WORKFLOW_TASKS } from "@/lib/mock";
import type { CreateTaskInput, TaskRecurrence } from "@/types/workflow";

const RECURRENCES: TaskRecurrence[] = ["none", "daily", "weekly", "fortnightly", "monthly", "quarterly"];

export async function GET() {
  if (!isWorkflowConfigured()) {
    return NextResponse.json({ mode: "mock", tasks: WORKFLOW_TASKS });
  }
  try {
    const tasks = await listTaskViews();
    return NextResponse.json({ mode: "live", tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ mode: "live", tasks: [], message }, { status: 502 });
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
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const statusId = typeof body.statusId === "string" ? body.statusId : "";
  if (!jobId || !title || !statusId) {
    return NextResponse.json({ message: "jobId, title and statusId are required." }, { status: 400 });
  }
  const recurrence: TaskRecurrence = RECURRENCES.includes(body.recurrence) ? body.recurrence : "none";
  const input: CreateTaskInput = {
    jobId,
    title,
    type: typeof body.type === "string" && body.type.trim() ? body.type.trim() : "General",
    statusId,
    recurrence,
    assigneeId: typeof body.assigneeId === "string" ? body.assigneeId : null,
    dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
  };
  try {
    const task = await createTask(input);
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message }, { status: 502 });
  }
}
