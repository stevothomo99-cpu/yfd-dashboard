import { getSupabaseAdmin } from "./supabase";
import { createTask, getStaffById, getStaffByEmail, listStatuses } from "./workflow";
import { todoDisplayName } from "./utils";
import { sendEmail } from "./resend";
import type { RecurrenceInterval, TodoItem, TodoItemStatus } from "@/types/workflow";

// Data-access layer for lightweight email-forwarded to-do items -- see
// migrations/012_todo_items.sql and app/api/email/inbound/route.ts for how
// they're created, and types/workflow.ts's TodoItem doc comment for the
// pending_triage -> todo/converted lifecycle. migrations/026 adds
// assigned_by_staff_id for the "Assign to" picker (§4.8) -- see the
// notifyTodoAssigned/notifyTodoResolved helpers below.

const SITE_URL = process.env.AUTH_URL ?? "https://dashboard.yourfinancedept.com.au";

interface TodoItemRow {
  id: string;
  owner_staff_id: string;
  assigned_by_staff_id: string | null;
  created_by_email: string | null;
  created_by_name: string | null;
  subject: string;
  title: string | null;
  body: string | null;
  customer_id: string | null;
  due_date: string | null;
  status: TodoItemStatus;
  converted_task_id: string | null;
  created_at: string;
  customers: { name: string } | null;
}

function mapTodoItem(row: TodoItemRow): TodoItem {
  return {
    id: row.id,
    ownerStaffId: row.owner_staff_id,
    assignedByStaffId: row.assigned_by_staff_id,
    createdByEmail: row.created_by_email,
    createdByName: row.created_by_name,
    subject: row.subject,
    title: row.title,
    body: row.body,
    customerId: row.customer_id,
    customerName: row.customers?.name ?? null,
    dueDate: row.due_date,
    status: row.status,
    convertedTaskId: row.converted_task_id,
    createdAt: row.created_at,
  };
}

const TODO_SELECT =
  "id, owner_staff_id, assigned_by_staff_id, created_by_email, created_by_name, subject, title, body, customer_id, due_date, status, converted_task_id, created_at, customers(name)";

// Fired whenever populateTodoItem/updateTodoItemDetails actually changes
// who owns a to-do (not on every save -- only when the assignee picker was
// used to hand it to someone new). Best-effort, same as every other
// notification in this app -- a failed email should never fail the save
// that triggered it.
async function notifyTodoAssigned(todo: TodoItem, assignedByStaffId: string | null): Promise<void> {
  const owner = await getStaffById(todo.ownerStaffId);
  if (!owner) return;
  const assignedBy = assignedByStaffId ? await getStaffById(assignedByStaffId) : null;

  await sendEmail({
    to: owner.email,
    subject: `To-do assigned to you: ${todoDisplayName(todo)}`,
    text:
      `Hi ${owner.name.split(" ")[0]},\n\n` +
      (assignedBy && assignedBy.id !== owner.id
        ? `${assignedBy.name} assigned you a to-do:\n\n`
        : `You've been assigned a to-do:\n\n`) +
      `"${todoDisplayName(todo)}"` +
      (todo.customerName ? ` (${todo.customerName})` : "") +
      (todo.dueDate ? `\nDue ${todo.dueDate}` : "") +
      `\n\nView it: ${SITE_URL}/dashboard`,
  });
}

// Fired when a to-do that was explicitly assigned (assigned_by_staff_id
// set) is marked done or discarded -- tells whoever assigned it that it's
// resolved, one way or the other. Never fires for a to-do nobody manually
// assigned (self to-dos and ones resolved purely by email To/Cc routing),
// since there's no one to report back to.
async function notifyTodoResolved(
  assignedByStaffId: string,
  ownerStaffId: string,
  title: string,
  outcome: "done" | "discarded",
): Promise<void> {
  const assignedBy = await getStaffById(assignedByStaffId);
  if (!assignedBy) return;
  const owner = await getStaffById(ownerStaffId);
  const ownerName = owner?.name ?? "Someone";

  await sendEmail({
    to: assignedBy.email,
    subject: `To-do ${outcome === "done" ? "completed" : "discarded"}: ${title}`,
    text:
      `Hi ${assignedBy.name.split(" ")[0]},\n\n` +
      `The to-do you assigned to ${ownerName}, "${title}", was just marked ${outcome === "done" ? "done" : "discarded"}.\n\n` +
      `${SITE_URL}/dashboard`,
  });
}

export async function listTodoItemsForStaff(staffId: string): Promise<TodoItem[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("todo_items")
    .select(TODO_SELECT)
    .eq("owner_staff_id", staffId)
    .neq("status", "converted")
    .order("created_at", { ascending: false })
    .returns<TodoItemRow[]>();

  if (error) {
    console.error("[todos] listTodoItemsForStaff failed:", error.message);
    return [];
  }
  return (data ?? []).map(mapTodoItem);
}

// A to-do line shaped for the report emails (lib/mondayReport.ts,
// lib/dailyDigest.ts) -- just enough to list, not the full TodoItem.
export interface TodoLine {
  id: string;
  title: string;
  customerName: string | null;
  dueDate: string | null;
  status: TodoItemStatus;
}

// Outstanding to-dos for staffId -- pending_triage (needs a client/due date
// set before it means anything) or todo (populated, still open).
// listTodoItemsForStaff already excludes "converted" (now a real Task); this
// also excludes "done" (a completed one-off needs no more action) since a
// report of *outstanding* items has no use for either terminal state.
export async function listOutstandingTodoLines(staffId: string): Promise<TodoLine[]> {
  const items = await listTodoItemsForStaff(staffId);
  return items
    .filter((t) => t.status === "pending_triage" || t.status === "todo")
    .map((t) => ({
      id: t.id,
      title: todoDisplayName(t),
      customerName: t.customerName,
      dueDate: t.dueDate,
      status: t.status,
    }));
}

// Practice-wide view for admins -- same "not converted" filter (a converted
// item's follow-up now lives as a normal Task on the relevant board).
export async function listAllTodoItems(): Promise<TodoItem[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("todo_items")
    .select(TODO_SELECT)
    .neq("status", "converted")
    .order("created_at", { ascending: false })
    .returns<TodoItemRow[]>();

  if (error) {
    console.error("[todos] listAllTodoItems failed:", error.message);
    return [];
  }
  return (data ?? []).map(mapTodoItem);
}

export interface CreateTodoItemInput {
  ownerStaffId: string;
  createdByEmail: string | null;
  createdByName: string | null;
  subject: string;
  body: string | null;
  sourceEmailId: string | null;
}

// Returns null (not an error) if sourceEmailId already exists -- the
// inbound webhook route treats that as "already processed, nothing to do"
// rather than a failure, since webhook deliveries can be retried.
export async function createTodoItem(input: CreateTodoItemInput): Promise<TodoItem | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("todo_items")
    .insert({
      owner_staff_id: input.ownerStaffId,
      created_by_email: input.createdByEmail,
      created_by_name: input.createdByName,
      subject: input.subject,
      body: input.body,
      source_email_id: input.sourceEmailId,
    })
    .select(TODO_SELECT)
    .single<TodoItemRow>();

  if (error) {
    if (error.code === "23505") return null; // unique violation on source_email_id -- duplicate delivery
    console.error("[todos] createTodoItem failed:", error.message);
    return null;
  }
  return mapTodoItem(data);
}

export async function getTodoItem(id: string): Promise<TodoItem | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("todo_items")
    .select(TODO_SELECT)
    .eq("id", id)
    .maybeSingle<TodoItemRow>();

  if (error) {
    console.error("[todos] getTodoItem failed:", error.message);
    return null;
  }
  return data ? mapTodoItem(data) : null;
}

// Notifies whoever assigned it (if anyone did) on the way to done/discarded
// -- fetched before the mutation since a discard deletes the row outright.
export async function markTodoItemDone(id: string, done: boolean): Promise<TodoItem | null> {
  const before = done ? await getTodoItem(id) : null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("todo_items")
    .update({ status: done ? "done" : "todo" })
    .eq("id", id)
    .select(TODO_SELECT)
    .single<TodoItemRow>();

  if (error) {
    console.error("[todos] markTodoItemDone failed:", error.message);
    return null;
  }
  const todo = mapTodoItem(data);

  // Only fires on completing (not reopening), and only when someone
  // explicitly assigned this rather than it just landing via email routing.
  if (done && before?.assignedByStaffId) {
    await notifyTodoResolved(before.assignedByStaffId, todo.ownerStaffId, todoDisplayName(todo), "done");
  }
  return todo;
}

// Changes the client/due date/assignee of an already-populated to-do
// without touching its status -- editing a completed item must leave it
// completed, which is why this doesn't go through populateTodoItem (that
// one forces status back to "todo", correct when triaging a new item,
// wrong here). assigneeStaffId is optional and only reassigns when it
// actually differs from the current owner -- actorStaffId is who's making
// this edit, recorded (and used to notify the new owner) only when a
// reassignment actually happens.
export async function updateTodoItemDetails(
  id: string,
  input: { customerId: string; dueDate: string | null; title?: string | null; assigneeStaffId?: string },
  actorStaffId: string | null = null,
): Promise<TodoItem | null> {
  const current = await getTodoItem(id);
  if (!current) return null;
  const reassigned = Boolean(input.assigneeStaffId && input.assigneeStaffId !== current.ownerStaffId);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("todo_items")
    .update({
      customer_id: input.customerId,
      due_date: input.dueDate,
      // Undefined means "leave the name alone"; null clears a rename back
      // to the original email subject.
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(reassigned ? { owner_staff_id: input.assigneeStaffId, assigned_by_staff_id: actorStaffId } : {}),
    })
    .eq("id", id)
    .select(TODO_SELECT)
    .single<TodoItemRow>();

  if (error) {
    console.error("[todos] updateTodoItemDetails failed:", error.message);
    return null;
  }
  const todo = mapTodoItem(data);
  if (reassigned) await notifyTodoAssigned(todo, actorStaffId);
  return todo;
}

export async function discardTodoItem(id: string): Promise<boolean> {
  const before = await getTodoItem(id);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("todo_items").delete().eq("id", id);
  if (error) {
    console.error("[todos] discardTodoItem failed:", error.message);
    return false;
  }

  if (before?.assignedByStaffId) {
    await notifyTodoResolved(before.assignedByStaffId, before.ownerStaffId, todoDisplayName(before), "discarded");
  }
  return true;
}

export interface PopulateTodoItemInput {
  customerId: string;
  dueDate: string | null;
  recurrence: RecurrenceInterval;
  // Defaults to the to-do's current owner when omitted -- only a genuine
  // change from that triggers the reassignment bookkeeping/notification
  // below.
  assigneeStaffId?: string;
}

export type PopulateTodoItemResult =
  | { kind: "todo"; todo: TodoItem }
  | { kind: "converted"; taskId: string };

// One-off (recurrence "none") just fills in customer/due date and stays a
// to-do. Anything recurring is promoted into a real Task instead -- title
// from the email subject, default open status -- and the to-do item is
// marked "converted" rather than deleted, so its origin (created_by_email/
// subject/body) stays traceable from convertedTaskId. actorStaffId is
// whoever's performing this triage (from the API route's session), used
// only to record/notify a reassignment -- null leaves assigned_by_staff_id
// unset, same as before this existed.
export async function populateTodoItem(
  id: string,
  input: PopulateTodoItemInput,
  actorStaffId: string | null = null,
): Promise<PopulateTodoItemResult | null> {
  const todo = await getTodoItem(id);
  if (!todo) return null;

  const assigneeId = input.assigneeStaffId ?? todo.ownerStaffId;
  const reassigned = assigneeId !== todo.ownerStaffId;

  if (input.recurrence === "none") {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("todo_items")
      .update({
        customer_id: input.customerId,
        due_date: input.dueDate,
        status: "todo",
        ...(reassigned ? { owner_staff_id: assigneeId, assigned_by_staff_id: actorStaffId } : {}),
      })
      .eq("id", id)
      .select(TODO_SELECT)
      .single<TodoItemRow>();

    if (error) {
      console.error("[todos] populateTodoItem (one-off) failed:", error.message);
      return null;
    }
    const populated = mapTodoItem(data);
    if (reassigned) await notifyTodoAssigned(populated, actorStaffId);
    return { kind: "todo", todo: populated };
  }

  const statuses = await listStatuses();
  const openStatus = [...statuses].sort((a, b) => a.sortOrder - b.sortOrder).find((s) => !s.isComplete);
  const statusId = openStatus?.id ?? statuses[0]?.id;
  if (!statusId) return null;

  const task = await createTask({
    customerId: input.customerId,
    title: todoDisplayName(todo),
    statusId,
    assigneeId,
    dueDate: input.dueDate,
    recurrence: input.recurrence,
  });
  if (!task) return null;

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("todo_items")
    .update({ customer_id: input.customerId, due_date: input.dueDate, status: "converted", converted_task_id: task.id })
    .eq("id", id);
  if (error) {
    console.error("[todos] populateTodoItem (converted) failed to update todo row:", error.message);
    // The task itself was created successfully -- don't fail the whole
    // operation over the todo_items bookkeeping update.
  }

  return { kind: "converted", taskId: task.id };
}

// Resolves who a to-do belongs to from the forwarded email's To/Cc, per the
// two flows: self (the shared address is in To -- owner is whoever sent
// it) or delegated (the shared address is only in Cc -- owner is whoever
// in To matches a known staff email; Steve forwarding to several people at
// once produces one to-do per match). Returns owners already resolved to
// staff ids, deduped, so the caller can create one todo_item per owner.
export async function resolveTodoOwners(
  toAddresses: string[],
  ccAddresses: string[],
  fromAddress: string,
  sharedInboxAddress: string,
): Promise<{ id: string; email: string; name: string }[]> {
  const normalize = (a: string) => a.trim().toLowerCase();
  const shared = normalize(sharedInboxAddress);
  const to = toAddresses.map(normalize);
  const cc = ccAddresses.map(normalize);

  const candidateEmails =
    to.includes(shared)
      ? [normalize(fromAddress)]
      : cc.includes(shared)
        ? to.filter((a) => a !== shared)
        : [];

  const owners: { id: string; email: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const email of candidateEmails) {
    const staff = await getStaffByEmail(email);
    if (staff && !seen.has(staff.id)) {
      seen.add(staff.id);
      owners.push({ id: staff.id, email: staff.email, name: staff.name });
    }
  }
  return owners;
}
