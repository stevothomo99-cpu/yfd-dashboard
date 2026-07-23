import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { createTask, getJobsInScopeForStaff, getStaffByEmail } from "@/lib/workflow";
import type { CreateTaskInput } from "@/types/workflow";

// Any authenticated user may create a task, but non-admins are scoped to
// jobs within their own Partner/Manager/Staff hierarchy -- a "Staff"-role
// person can only create on a job belonging to a client they manage (see
// getJobsInScopeForStaff), Manager/Partner get their existing broader scope,
// and admins (session.user.role === "admin", the login-level flag -- not to
// be confused with staff.role) get no restriction at all, same as today.
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

  try {
    const body = (await request.json()) as Partial<CreateTaskInput>;
    const { jobId, title, statusId } = body;

    if (!jobId || !title?.trim() || !statusId) {
      return NextResponse.json(
        { error: "jobId, title, and statusId are required" },
        { status: 400 }
      );
    }

    if (!isAdmin && staff) {
      const scopedJobs = await getJobsInScopeForStaff(staff);
      if (!scopedJobs.some((j) => j.id === jobId)) {
        return NextResponse.json(
          { error: "You don't have permission to create a task on that job" },
          { status: 403 }
        );
      }
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
