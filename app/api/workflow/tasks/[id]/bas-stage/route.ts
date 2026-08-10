import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { canModifyTask, getAllTasks, getStaffByEmail, getTaskById, setBasStage } from "@/lib/workflow";
import { BAS_TASK_TYPE_ID } from "@/lib/workOverview";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import type { BasStage } from "@/types/workflow";

// The Partner/admin who approves BAS/IAS work on /bas-status -- confirmed
// directly (staff.id for Steve Thomas). Fixed rather than configurable:
// there's exactly one approver in this workflow today.
const APPROVER_STAFF_ID = "777f9f6f-f2f9-421f-b903-d8f2549a6078";
const APPROVER_EMAIL = "steve@yourfinancedept.com.au";

const VALID_STAGES: BasStage[] = ["pending", "ready_for_approval", "waiting_on_customer"];

// Pipeline order -- a transition is only valid if it moves exactly one step
// either direction (no skipping straight from Pending to Waiting on
// Customer or back).
const STAGE_ORDER: Record<BasStage, number> = {
  pending: 0,
  ready_for_approval: 1,
  waiting_on_customer: 2,
};

function formatDue(dueDate: string | null): string {
  if (!dueDate) return "No due date";
  return new Date(dueDate + "T00:00:00Z").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Moves a single BAS/IAS task between the /bas-status board's tiles, one
// adjacent stage at a time in either direction -- see lib/workflow.ts's
// setBasStage for the reassignment side effect and history row this
// triggers. Same permission model as the general task PATCH route: admins
// may action any task, everyone else only their own board (own/temp-
// assigned, or their Partner/Manager roll-up).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";
  const staff = session.user.email ? await getStaffByEmail(session.user.email) : null;
  if (!isAdmin && !staff) {
    return NextResponse.json({ error: "No staff record linked to your login email" }, { status: 403 });
  }

  const { id: taskId } = await params;

  if (!isAdmin && staff) {
    const allowed = await canModifyTask(staff, taskId);
    if (!allowed) {
      return NextResponse.json({ error: "You don't have permission to update this task" }, { status: 403 });
    }
  }

  let stage: BasStage;
  try {
    const body = (await request.json()) as { stage?: string };
    if (!body.stage || !VALID_STAGES.includes(body.stage as BasStage)) {
      return NextResponse.json(
        { error: "stage must be 'pending', 'ready_for_approval', or 'waiting_on_customer'" },
        { status: 400 }
      );
    }
    stage = body.stage as BasStage;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const task = await getTaskById(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Only BAS/IAS-typed tasks go through this pipeline -- anything else is
  // rejected outright rather than silently no-op'd, so a stray request
  // (e.g. a stale client) surfaces instead of quietly leaving bas_stage
  // unset on a task the board was never meant to show.
  if (task.typeId !== BAS_TASK_TYPE_ID) {
    return NextResponse.json({ error: "Only BAS/IAS tasks can move through this pipeline" }, { status: 400 });
  }

  const currentStage: BasStage = task.basStage ?? "pending";
  if (Math.abs(STAGE_ORDER[stage] - STAGE_ORDER[currentStage]) !== 1) {
    return NextResponse.json(
      { error: "A task can only move to an adjacent stage, one step at a time" },
      { status: 400 }
    );
  }

  const result = await setBasStage(taskId, stage, APPROVER_STAFF_ID, staff?.id ?? null);
  if (!result) {
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
  const { task: updated, historyEntry } = result;

  if (stage === "ready_for_approval") {
    // A live snapshot of the whole queue as it stands right after this
    // update, not a stored digest -- every other BAS/IAS task also sitting
    // in "Ready for Approval", soonest due date first. Fires regardless of
    // which direction the task arrived from (Pending forward, or Waiting on
    // Customer back).
    const allTasks = await getAllTasks();
    const queue = allTasks
      .filter((t) => t.typeId === BAS_TASK_TYPE_ID && (t.basStage ?? "pending") === "ready_for_approval")
      .sort((a, b) => (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99"));

    if (!isResendConfigured()) {
      console.log(
        `[bas-stage] Resend not configured -- would have emailed ${APPROVER_EMAIL} about "${updated.title}" (${queue.length} task(s) now ready for approval)`
      );
    } else {
      const subject = `BAS ready for approval: ${updated.customerName} — ${updated.title}`;
      const lines = queue.map(
        (t) => `- ${t.customerName} — ${t.title} (due ${formatDue(t.dueDate)})${t.id === updated.id ? "  [just submitted]" : ""}`
      );
      const text = [
        `${updated.customerName} — ${updated.title} was just marked Ready for Approval (due ${formatDue(updated.dueDate)}).`,
        "",
        `Full "Ready for Approval" queue (${queue.length} task${queue.length === 1 ? "" : "s"}):`,
        ...lines,
      ].join("\n");
      const html = [
        `<p><strong>${escapeHtml(updated.customerName)} — ${escapeHtml(updated.title)}</strong> was just marked Ready for Approval (due ${formatDue(updated.dueDate)}).</p>`,
        `<p>Full "Ready for Approval" queue (${queue.length} task${queue.length === 1 ? "" : "s"}):</p>`,
        "<ul>",
        ...queue.map(
          (t) =>
            `<li>${escapeHtml(t.customerName)} — ${escapeHtml(t.title)} (due ${formatDue(t.dueDate)})${t.id === updated.id ? " <em>[just submitted]</em>" : ""}</li>`
        ),
        "</ul>",
      ].join("\n");

      await sendEmail({ to: APPROVER_EMAIL, subject, text, html });
    }
  }

  return NextResponse.json({ task: updated, historyEntry });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
