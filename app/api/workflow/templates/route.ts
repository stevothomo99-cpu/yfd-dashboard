import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { listTaskTemplates, saveTasksAsTemplate } from "@/lib/workflow";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const templates = await listTaskTemplates();
  return NextResponse.json({ templates });
}

// Saves a chosen set of existing tasks as a new reusable template -- see
// lib/workflow.ts's saveTasksAsTemplate for exactly what is/isn't captured.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as { name?: string; taskIds?: string[] };
  const name = body.name?.trim();
  const taskIds = body.taskIds ?? [];

  if (!name) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }
  if (taskIds.length === 0) {
    return NextResponse.json({ error: "At least one task must be selected" }, { status: 400 });
  }

  const template = await saveTasksAsTemplate(name, taskIds);
  if (!template) {
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
  return NextResponse.json({ template });
}
