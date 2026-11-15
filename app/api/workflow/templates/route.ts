import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { canModifyTask, getStaffByEmail, listTaskTemplates, saveTasksAsTemplate } from "@/lib/workflow";

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
// Admins may template any task; everyone else needs canModifyTask on every
// task id supplied (same check PATCH/DELETE use), since this is really a
// bulk read of those tasks' details -- without it, a non-admin could snapshot
// tasks outside their own client scope just by guessing/enumerating ids.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";
  const staff = session.user.email ? await getStaffByEmail(session.user.email) : null;
  if (!isAdmin && !staff) {
    return NextResponse.json({ error: "No staff record linked to your login email" }, { status: 403 });
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

  if (!isAdmin && staff) {
    const allowed = await Promise.all(taskIds.map((taskId) => canModifyTask(staff, taskId)));
    if (allowed.some((ok) => !ok)) {
      return NextResponse.json(
        { error: "You don't have permission to template one or more of those tasks" },
        { status: 403 }
      );
    }
  }

  const template = await saveTasksAsTemplate(name, taskIds);
  if (!template) {
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
  return NextResponse.json({ template });
}
