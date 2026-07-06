import { supabaseAdmin, isSupabaseConfigured, SupabaseNotConfiguredError } from "./supabaseAdmin";
import { nextDueDate } from "./recurrence";
import { fetchXpmClientsForPartner, fetchXpmStaffForPartner } from "./xpm";
import {
  WORKFLOW_STAFF,
  WORKFLOW_CUSTOMERS,
  WORKFLOW_JOBS,
  WORKFLOW_TASKS,
  WORKFLOW_STATUSES,
} from "./mock";
import type {
  WorkflowStaff,
  WorkflowCustomer,
  WorkflowJob,
  WorkflowStatus,
  WorkflowTask,
  WorkflowTaskView,
  CreateTaskInput,
  CreateJobInput,
} from "@/types/workflow";

export { isSupabaseConfigured as isWorkflowConfigured, SupabaseNotConfiguredError };

// ─── Row → domain mapping ───────────────────────────────────────────────────

interface StaffRow {
  id: string;
  xpm_staff_id: string | null;
  name: string;
  email: string;
  role: WorkflowStaff["role"];
  included: boolean;
}

function mapStaff(row: StaffRow): WorkflowStaff {
  return {
    id: row.id,
    xpmStaffId: row.xpm_staff_id,
    name: row.name,
    email: row.email,
    role: row.role,
    included: row.included,
  };
}

interface CustomerRow {
  id: string;
  xpm_client_id: string | null;
  name: string;
  partner_id: string | null;
}

function mapCustomer(row: CustomerRow): WorkflowCustomer {
  return { id: row.id, xpmClientId: row.xpm_client_id, name: row.name, partnerId: row.partner_id };
}

interface JobRow {
  id: string;
  customer_id: string;
  xpm_job_id: string | null;
  name: string;
  partner_id: string | null;
  manager_id: string | null;
}

function mapJob(row: JobRow): WorkflowJob {
  return {
    id: row.id,
    customerId: row.customer_id,
    xpmJobId: row.xpm_job_id,
    name: row.name,
    partnerId: row.partner_id,
    managerId: row.manager_id,
  };
}

interface StatusRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_complete: boolean;
}

function mapStatus(row: StatusRow): WorkflowStatus {
  return { id: row.id, name: row.name, color: row.color, sortOrder: row.sort_order, isComplete: row.is_complete };
}

interface TaskViewRow {
  id: string;
  job_id: string;
  title: string;
  assignee_id: string | null;
  due_date: string | null;
  status_id: string;
  recurrence: WorkflowTask["recurrence"];
  recurrence_parent_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  job: {
    id: string;
    name: string;
    customer_id: string;
    partner_id: string | null;
    manager_id: string | null;
    customer: { id: string; name: string } | null;
  } | null;
  assignee: { id: string; name: string } | null;
  status: StatusRow;
}

function mapTaskView(row: TaskViewRow): WorkflowTaskView {
  return {
    id: row.id,
    jobId: row.job_id,
    jobName: row.job?.name ?? "",
    customerId: row.job?.customer_id ?? "",
    customerName: row.job?.customer?.name ?? "",
    partnerId: row.job?.partner_id ?? null,
    managerId: row.job?.manager_id ?? null,
    title: row.title,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee?.name ?? null,
    dueDate: row.due_date,
    statusId: row.status_id,
    status: mapStatus(row.status),
    recurrence: row.recurrence,
    recurrenceParentId: row.recurrence_parent_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TASK_VIEW_SELECT = `
  id, job_id, title, assignee_id, due_date, status_id, recurrence, recurrence_parent_id,
  completed_at, created_at, updated_at,
  job:jobs ( id, name, customer_id, partner_id, manager_id, customer:customers ( id, name ) ),
  assignee:staff ( id, name ),
  status:statuses ( id, name, color, sort_order, is_complete )
`;

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listStatuses(): Promise<WorkflowStatus[]> {
  const { data, error } = await supabaseAdmin().from("statuses").select("*").order("sort_order");
  if (error) throw new Error(`Supabase statuses query failed: ${error.message}`);
  return (data as StatusRow[]).map(mapStatus);
}

export async function listStaff(): Promise<WorkflowStaff[]> {
  const { data, error } = await supabaseAdmin().from("staff").select("*").order("name");
  if (error) throw new Error(`Supabase staff query failed: ${error.message}`);
  return (data as StaffRow[]).map(mapStaff);
}

export async function listCustomers(): Promise<WorkflowCustomer[]> {
  const { data, error } = await supabaseAdmin().from("customers").select("*").order("name");
  if (error) throw new Error(`Supabase customers query failed: ${error.message}`);
  return (data as CustomerRow[]).map(mapCustomer);
}

export async function listJobs(): Promise<WorkflowJob[]> {
  const { data, error } = await supabaseAdmin().from("jobs").select("*").order("name");
  if (error) throw new Error(`Supabase jobs query failed: ${error.message}`);
  return (data as JobRow[]).map(mapJob);
}

export async function listTaskViews(): Promise<WorkflowTaskView[]> {
  const { data, error } = await supabaseAdmin()
    .from("tasks")
    .select(TASK_VIEW_SELECT)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Supabase tasks query failed: ${error.message}`);
  return (data as unknown as TaskViewRow[]).map(mapTaskView);
}

export interface WorkflowSnapshot {
  mode: "live" | "mock";
  staff: WorkflowStaff[];
  customers: WorkflowCustomer[];
  jobs: WorkflowJob[];
  tasks: WorkflowTaskView[];
  statuses: WorkflowStatus[];
  syncedAt: string;
  message?: string;
}

export async function loadWorkflowSnapshot(): Promise<WorkflowSnapshot> {
  if (!isSupabaseConfigured()) {
    return {
      mode: "mock",
      staff: WORKFLOW_STAFF,
      customers: WORKFLOW_CUSTOMERS,
      jobs: WORKFLOW_JOBS,
      tasks: WORKFLOW_TASKS,
      statuses: WORKFLOW_STATUSES,
      syncedAt: new Date().toISOString(),
      message: "Showing mock data because SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.",
    };
  }
  try {
    const [staff, customers, jobs, tasks, statuses] = await Promise.all([
      listStaff(),
      listCustomers(),
      listJobs(),
      listTaskViews(),
      listStatuses(),
    ]);
    return { mode: "live", staff, customers, jobs, tasks, statuses, syncedAt: new Date().toISOString() };
  } catch (err) {
    if (err instanceof SupabaseNotConfiguredError) {
      return {
        mode: "mock",
        staff: WORKFLOW_STAFF,
        customers: WORKFLOW_CUSTOMERS,
        jobs: WORKFLOW_JOBS,
        tasks: WORKFLOW_TASKS,
        statuses: WORKFLOW_STATUSES,
        syncedAt: new Date().toISOString(),
        message: err.message,
      };
    }
    return {
      mode: "live",
      staff: [],
      customers: [],
      jobs: [],
      tasks: [],
      statuses: [],
      syncedAt: new Date().toISOString(),
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function createCustomer(name: string, partnerId: string | null): Promise<WorkflowCustomer> {
  const { data, error } = await supabaseAdmin()
    .from("customers")
    .insert({ name, partner_id: partnerId })
    .select()
    .single();
  if (error) throw new Error(`Failed to create customer: ${error.message}`);
  return mapCustomer(data as CustomerRow);
}

export async function createJob(input: CreateJobInput): Promise<WorkflowJob> {
  const { data, error } = await supabaseAdmin()
    .from("jobs")
    .insert({
      customer_id: input.customerId,
      name: input.name,
      partner_id: input.partnerId,
      manager_id: input.managerId,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create job: ${error.message}`);
  return mapJob(data as JobRow);
}

export async function createTask(input: CreateTaskInput): Promise<WorkflowTask> {
  const { data, error } = await supabaseAdmin()
    .from("tasks")
    .insert({
      job_id: input.jobId,
      title: input.title,
      assignee_id: input.assigneeId,
      due_date: input.dueDate,
      status_id: input.statusId,
      recurrence: input.recurrence,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create task: ${error.message}`);
  return mapTaskRow(data);
}

interface RawTaskRow {
  id: string;
  job_id: string;
  title: string;
  assignee_id: string | null;
  due_date: string | null;
  status_id: string;
  recurrence: WorkflowTask["recurrence"];
  recurrence_parent_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapTaskRow(row: RawTaskRow): WorkflowTask {
  return {
    id: row.id,
    jobId: row.job_id,
    title: row.title,
    assigneeId: row.assignee_id,
    dueDate: row.due_date,
    statusId: row.status_id,
    recurrence: row.recurrence,
    recurrenceParentId: row.recurrence_parent_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface UpdateTaskStatusResult {
  task: WorkflowTask;
  nextTask: WorkflowTask | null;
}

// Sets a task's status. If the new status is the "complete" status and the
// task recurs, immediately creates the next instance due off the current
// task's own due date (generate-on-completion, per lib/recurrence.ts).
export async function updateTaskStatus(taskId: string, statusId: string): Promise<UpdateTaskStatusResult> {
  const db = supabaseAdmin();

  const { data: statusRow, error: statusErr } = await db
    .from("statuses")
    .select("is_complete")
    .eq("id", statusId)
    .single();
  if (statusErr) throw new Error(`Failed to load status: ${statusErr.message}`);

  const becomingComplete = (statusRow as { is_complete: boolean }).is_complete;
  const { data: updated, error: updateErr } = await db
    .from("tasks")
    .update({
      status_id: statusId,
      completed_at: becomingComplete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .select()
    .single();
  if (updateErr) throw new Error(`Failed to update task: ${updateErr.message}`);

  const task = mapTaskRow(updated as RawTaskRow);
  if (!becomingComplete || task.recurrence === "none" || !task.dueDate) {
    return { task, nextTask: null };
  }

  const { data: openStatus, error: openErr } = await db
    .from("statuses")
    .select("id")
    .eq("is_complete", false)
    .order("sort_order")
    .limit(1)
    .single();
  if (openErr) throw new Error(`Failed to find an open status for the recurring task: ${openErr.message}`);

  const due = nextDueDate(task.dueDate, task.recurrence);
  const { data: created, error: createErr } = await db
    .from("tasks")
    .insert({
      job_id: task.jobId,
      title: task.title,
      assignee_id: task.assigneeId,
      due_date: due,
      status_id: (openStatus as { id: string }).id,
      recurrence: task.recurrence,
      recurrence_parent_id: task.id,
    })
    .select()
    .single();
  if (createErr) throw new Error(`Failed to create next recurring task: ${createErr.message}`);

  return { task, nextTask: mapTaskRow(created as RawTaskRow) };
}

export interface UpdateTaskInput {
  title?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  recurrence?: WorkflowTask["recurrence"];
}

export async function updateTask(taskId: string, patch: UpdateTaskInput): Promise<WorkflowTask> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.assigneeId !== undefined) update.assignee_id = patch.assigneeId;
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate;
  if (patch.recurrence !== undefined) update.recurrence = patch.recurrence;

  const { data, error } = await supabaseAdmin()
    .from("tasks")
    .update(update)
    .eq("id", taskId)
    .select()
    .single();
  if (error) throw new Error(`Failed to update task: ${error.message}`);
  return mapTaskRow(data as RawTaskRow);
}

// ─── XPM sync ───────────────────────────────────────────────────────────────
// Pulls Managers + Clients from XPM (lib/xpm.ts, already OAuth-configured for
// the reporting dashboard) and upserts them as workflow staff/customers.
// Jobs stay app-native for now — XPM's Job resource doesn't expose a
// confirmed name/id field to sync against yet (see lib/xpm.ts comments).
export interface SyncResult {
  staffSynced: number;
  customersSynced: number;
}

async function ensurePartnerStaff(partnerName: string): Promise<string> {
  const db = supabaseAdmin();
  const { data: existing, error: findErr } = await db
    .from("staff")
    .select("id")
    .eq("role", "Partner")
    .eq("name", partnerName)
    .maybeSingle();
  if (findErr) throw new Error(`Failed to look up partner staff row: ${findErr.message}`);
  if (existing) return (existing as { id: string }).id;

  const { data: created, error: createErr } = await db
    .from("staff")
    .insert({ name: partnerName, email: "", role: "Partner" })
    .select("id")
    .single();
  if (createErr) throw new Error(`Failed to create partner staff row: ${createErr.message}`);
  return (created as { id: string }).id;
}

export async function syncFromXpm(partnerName: string): Promise<SyncResult> {
  if (!partnerName) throw new Error("Set a Partner name in Settings before syncing.");
  const db = supabaseAdmin();
  const partnerId = await ensurePartnerStaff(partnerName);

  const [managers, clients] = await Promise.all([
    fetchXpmStaffForPartner(partnerName),
    fetchXpmClientsForPartner(partnerName),
  ]);

  let staffSynced = 0;
  for (const m of managers) {
    const { error } = await db
      .from("staff")
      .upsert(
        { xpm_staff_id: m.id, name: m.name, email: m.email, role: "Manager", included: true },
        { onConflict: "xpm_staff_id" },
      );
    if (error) throw new Error(`Failed to sync staff ${m.name}: ${error.message}`);
    staffSynced++;
  }

  let customersSynced = 0;
  for (const c of clients) {
    const { error } = await db
      .from("customers")
      .upsert(
        { xpm_client_id: c.id, name: c.name, partner_id: partnerId },
        { onConflict: "xpm_client_id" },
      );
    if (error) throw new Error(`Failed to sync customer ${c.name}: ${error.message}`);
    customersSynced++;
  }

  return { staffSynced, customersSynced };
}
