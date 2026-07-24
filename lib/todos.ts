import { getSupabaseAdmin } from "./supabase";
import { createTask, getStaffByEmail, listStatuses } from "./workflow";
import type { RecurrenceInterval, TodoItem, TodoItemStatus } from "@/types/workflow";

// Data-access layer for lightweight email-forwarded to-do items -- see
// migrations/012_todo_items.sql and app/api/email/inbound/route.ts for how
// they're created, and types/workflow.ts's TodoItem doc comment for the
// pending_triage -> todo/converted lifecycle.

interface TodoItemRow {
  id: string;
  owner_staff_id: string;
  created_by_email: string | null;
  created_by_name: string | null;
  subject: string;
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
    createdByEmail: row.created_by_email,
    createdByName: row.created_by_name,
    subject: row.subject,
    body: row.body,
    customerId: row.customer_id,
    customerName: row.customers?.name ?? null,
    dueDate: row.due_date,
    status: row.status,
    convertedTaskId: row.converted_task_id,
    createdAt: row.created_at,
  };
}

const TODO_SELECT = "id, owner_staff_id, created_by_email, created_by_name, subject, body, customer_id, due_date, status, converted_task_id, created_at, customers(name)";

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

export async function markTodoItemDone(id: string, done: boolean): Promise<TodoItem | null> {
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
  return mapTodoItem(data);
}

export async function discardTodoItem(id: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("todo_items").delete().eq("id", id);
  if (error) {
    console.error("[todos] discardTodoItem failed:", error.message);
    return false;
  }
  return true;
}

export interface PopulateTodoItemInput {
  customerId: string;
  dueDate: string | null;
  recurrence: RecurrenceInterval;
  // Required only when recurrence !== "none" and the client has more than
  // one job -- the populate form resolves this the same client-first way
  // NewTaskModal does before calling in.
  jobId?: string;
}

export type PopulateTodoItemResult =
  | { kind: "todo"; todo: TodoItem }
  | { kind: "converted"; taskId: string };

// One-off (recurrence "none") just fills in customer/due date and stays a
// to-do. Anything recurring is promoted into a real Task instead -- title
// from the email subject, default open status, assigned to the to-do's
// owner (it was already theirs) -- and the to-do item is marked
// "converted" rather than deleted, so its origin (created_by_email/
// subject/body) stays traceable from convertedTaskId.
export async function populateTodoItem(
  id: string,
  input: PopulateTodoItemInput,
): Promise<PopulateTodoItemResult | null> {
  const todo = await getTodoItem(id);
  if (!todo) return null;

  if (input.recurrence === "none") {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("todo_items")
      .update({ customer_id: input.customerId, due_date: input.dueDate, status: "todo" })
      .eq("id", id)
      .select(
        "id, owner_staff_id, created_by_email, created_by_name, subject, body, customer_id, due_date, status, converted_task_id, created_at, customers(name)",
      )
      .single<TodoItemRow>();

    if (error) {
      console.error("[todos] populateTodoItem (one-off) failed:", error.message);
      return null;
    }
    return { kind: "todo", todo: mapTodoItem(data) };
  }

  if (!input.jobId) return null; // caller must resolve a job first for recurring items

  const statuses = await listStatuses();
  const openStatus = [...statuses].sort((a, b) => a.sortOrder - b.sortOrder).find((s) => !s.isComplete);
  const statusId = openStatus?.id ?? statuses[0]?.id;
  if (!statusId) return null;

  const task = await createTask({
    jobId: input.jobId,
    title: todo.subject,
    statusId,
    assigneeId: todo.ownerStaffId,
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
