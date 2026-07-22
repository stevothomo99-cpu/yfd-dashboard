import { getSupabaseAdmin } from "./supabase";
import type {
  ClientSummary,
  CreateTaskInput,
  CustomerFile,
  CustomerNote,
  JobWithCustomer,
  RecurrenceInterval,
  StaffRole,
  TaskWithDetails,
  WorkflowCustomer,
  WorkflowJob,
  WorkflowStaff,
  WorkflowStatus,
  WorkflowTaskType,
} from "@/types/workflow";

// Data-access layer for the XPM-native work-item system that replaces
// Karbon. Tables (staff/customers/jobs/tasks/statuses/task_types) live in
// the yfd-workflow Supabase project -- see migrations/003-006. All access
// goes through the service-role client (same pattern as lib/supabase.ts's
// dashboard_users functions) since RLS is enabled with no policies.

interface StaffRow {
  id: string;
  xpm_staff_id: string | null;
  name: string;
  email: string;
  role: StaffRole;
  included: boolean;
}

interface CustomerRow {
  id: string;
  xpm_client_id: string | null;
  name: string;
  partner_id: string | null;
}

interface JobRow {
  id: string;
  customer_id: string;
  xpm_job_id: string | null;
  name: string;
  partner_id: string | null;
  manager_id: string | null;
}

interface StatusRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_complete: boolean;
}

interface TaskTypeRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

interface TaskRow {
  id: string;
  job_id: string;
  title: string;
  assignee_id: string | null;
  temp_assignee_id: string | null;
  temp_assigned_at: string | null;
  due_date: string | null;
  start_date: string | null;
  status_id: string;
  type_id: string | null;
  recurrence: RecurrenceInterval;
  recurrence_parent_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
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

function mapCustomer(row: CustomerRow): WorkflowCustomer {
  return {
    id: row.id,
    xpmClientId: row.xpm_client_id,
    name: row.name,
    partnerId: row.partner_id,
  };
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

// Case-insensitive match, since the login email and the XPM staff email it
// must match are entered by different people at different times (login
// creation vs. XPM staff sync) -- same convention as lib/staffLink.ts's
// Karbon<->XPM email join.
export async function getStaffByEmail(email: string): Promise<WorkflowStaff | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("staff")
    .select("id, xpm_staff_id, name, email, role, included")
    .ilike("email", email)
    .maybeSingle<StaffRow>();

  if (error) {
    console.error("[workflow] getStaffByEmail failed:", error.message);
    return null;
  }
  return data ? mapStaff(data) : null;
}

export async function listStaff(role?: StaffRole): Promise<WorkflowStaff[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("staff")
    .select("id, xpm_staff_id, name, email, role, included")
    .order("name");

  if (role) query = query.eq("role", role);

  const { data, error } = await query.returns<StaffRow[]>();
  if (error) {
    console.error("[workflow] listStaff failed:", error.message);
    return [];
  }
  return (data ?? []).map(mapStaff);
}

export async function getPartners(): Promise<WorkflowStaff[]> {
  return listStaff("Partner");
}

// Clients attached to a Partner, optionally narrowed by a search string
// (case-insensitive match on name) for the searchable client picker.
export async function searchClientsForPartner(
  partnerId: string,
  search?: string
): Promise<WorkflowCustomer[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("customers")
    .select("id, xpm_client_id, name, partner_id")
    .eq("partner_id", partnerId)
    .order("name");

  if (search?.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  const { data, error } = await query.returns<CustomerRow[]>();
  if (error) {
    console.error("[workflow] searchClientsForPartner failed:", error.message);
    return [];
  }
  return (data ?? []).map(mapCustomer);
}

type JobRowWithCustomer = JobRow & { customers: { name: string } | null };

function mapJobWithCustomer(row: JobRowWithCustomer): JobWithCustomer {
  return {
    ...mapJob(row),
    customerName: row.customers?.name ?? "Unknown client",
  };
}

// In-progress jobs attached to a Manager (jobs table only ever holds jobs
// synced from XPM's InProgress job list -- see lib/xpm.ts's
// fetchXpmJobsForPartner -- so every row here already represents an
// in-progress job; there's no separate status column to filter on).
export async function getInProgressJobsForManager(
  managerId: string,
  search?: string
): Promise<JobWithCustomer[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("jobs")
    .select("id, customer_id, xpm_job_id, name, partner_id, manager_id, customers(name)")
    .eq("manager_id", managerId)
    .order("name");

  if (search?.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  const { data, error } = await query.returns<JobRowWithCustomer[]>();
  if (error) {
    console.error("[workflow] getInProgressJobsForManager failed:", error.message);
    return [];
  }

  return (data ?? []).map(mapJobWithCustomer);
}

// Every in-progress job under a Partner, across all their Managers -- feeds
// the "all managers" view on /jobs. Same in-progress caveat as above.
export async function getInProgressJobsForPartner(
  partnerId: string,
  search?: string
): Promise<JobWithCustomer[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("jobs")
    .select("id, customer_id, xpm_job_id, name, partner_id, manager_id, customers(name)")
    .eq("partner_id", partnerId)
    .order("name");

  if (search?.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  const { data, error } = await query.returns<JobRowWithCustomer[]>();
  if (error) {
    console.error("[workflow] getInProgressJobsForPartner failed:", error.message);
    return [];
  }

  return (data ?? []).map(mapJobWithCustomer);
}

async function fetchLookupMaps() {
  const admin = getSupabaseAdmin();
  const [{ data: statuses }, { data: taskTypes }, { data: staff }, { data: jobs }, { data: customers }] =
    await Promise.all([
      admin.from("statuses").select("id, name, color, sort_order, is_complete").returns<StatusRow[]>(),
      admin.from("task_types").select("id, name, color, sort_order").returns<TaskTypeRow[]>(),
      admin.from("staff").select("id, xpm_staff_id, name, email, role, included").returns<StaffRow[]>(),
      admin.from("jobs").select("id, customer_id, xpm_job_id, name, partner_id, manager_id").returns<JobRow[]>(),
      admin.from("customers").select("id, xpm_client_id, name, partner_id").returns<CustomerRow[]>(),
    ]);

  return {
    statusesById: new Map((statuses ?? []).map((s) => [s.id, s])),
    taskTypesById: new Map((taskTypes ?? []).map((t) => [t.id, t])),
    staffById: new Map((staff ?? []).map((s) => [s.id, s])),
    jobsById: new Map((jobs ?? []).map((j) => [j.id, j])),
    customersById: new Map((customers ?? []).map((c) => [c.id, c])),
  };
}

function hydrateTask(
  row: TaskRow,
  lookups: Awaited<ReturnType<typeof fetchLookupMaps>>
): TaskWithDetails {
  const status = lookups.statusesById.get(row.status_id);
  const type = row.type_id ? lookups.taskTypesById.get(row.type_id) : undefined;
  const job = lookups.jobsById.get(row.job_id);
  const customer = job ? lookups.customersById.get(job.customer_id) : undefined;
  const assignee = row.assignee_id ? lookups.staffById.get(row.assignee_id) : undefined;
  const tempAssignee = row.temp_assignee_id ? lookups.staffById.get(row.temp_assignee_id) : undefined;

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = Boolean(row.due_date && row.due_date < today && !status?.is_complete);

  return {
    id: row.id,
    jobId: row.job_id,
    title: row.title,
    assigneeId: row.assignee_id,
    tempAssigneeId: row.temp_assignee_id,
    tempAssignedAt: row.temp_assigned_at,
    dueDate: row.due_date,
    startDate: row.start_date,
    statusId: row.status_id,
    typeId: row.type_id,
    recurrence: row.recurrence,
    recurrenceParentId: row.recurrence_parent_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    jobName: job?.name ?? "Unknown job",
    customerName: customer?.name ?? "Unknown client",
    statusName: status?.name ?? "Unknown",
    statusColor: status?.color ?? "#888780",
    statusIsComplete: status?.is_complete ?? false,
    typeName: type?.name ?? null,
    typeColor: type?.color ?? null,
    assigneeName: assignee?.name ?? null,
    tempAssigneeName: tempAssignee?.name ?? null,
    isTemporarilyReassigned: Boolean(row.temp_assignee_id && row.temp_assignee_id !== row.assignee_id),
    isOverdue,
  };
}

// Every task currently on staffId's board: tasks they permanently own, plus
// tasks temporarily handed to them (which stay on the *owner's* board too --
// callers distinguish the two via isTemporarilyReassigned).
export async function getTasksForStaff(staffId: string): Promise<TaskWithDetails[]> {
  const admin = getSupabaseAdmin();
  const [{ data: owned, error: ownedError }, { data: tempAssigned, error: tempError }, lookups] =
    await Promise.all([
      admin.from("tasks").select("*").eq("assignee_id", staffId).returns<TaskRow[]>(),
      admin.from("tasks").select("*").eq("temp_assignee_id", staffId).returns<TaskRow[]>(),
      fetchLookupMaps(),
    ]);

  if (ownedError) console.error("[workflow] getTasksForStaff (owned) failed:", ownedError.message);
  if (tempError) console.error("[workflow] getTasksForStaff (temp) failed:", tempError.message);

  const byId = new Map<string, TaskRow>();
  for (const row of owned ?? []) byId.set(row.id, row);
  for (const row of tempAssigned ?? []) byId.set(row.id, row);

  return Array.from(byId.values())
    .map((row) => hydrateTask(row, lookups))
    .sort((a, b) => (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99"));
}

async function getTasksForJobIds(jobIds: string[]): Promise<TaskWithDetails[]> {
  if (jobIds.length === 0) return [];

  const admin = getSupabaseAdmin();
  const [{ data, error }, lookups] = await Promise.all([
    admin.from("tasks").select("*").in("job_id", jobIds).returns<TaskRow[]>(),
    fetchLookupMaps(),
  ]);

  if (error) {
    console.error("[workflow] getTasksForJobIds failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => hydrateTask(row, lookups));
}

function dedupeAndSortTasks(taskLists: TaskWithDetails[][]): TaskWithDetails[] {
  const byId = new Map<string, TaskWithDetails>();
  for (const list of taskLists) for (const task of list) byId.set(task.id, task);
  return Array.from(byId.values()).sort((a, b) =>
    (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99")
  );
}

// A Manager's board: every task under a job they manage (their team's work),
// plus anything personally assigned/temporarily handed to them directly.
export async function getTasksForManager(managerId: string): Promise<TaskWithDetails[]> {
  const managedJobs = await getInProgressJobsForManager(managerId);
  const [jobTasks, personalTasks] = await Promise.all([
    getTasksForJobIds(managedJobs.map((j) => j.id)),
    getTasksForStaff(managerId),
  ]);
  return dedupeAndSortTasks([jobTasks, personalTasks]);
}

// A Partner's board: every task under every job attached to their Partner
// scope (a practice-wide roll-up), plus any personal assignments.
export async function getTasksForPartner(partnerId: string): Promise<TaskWithDetails[]> {
  const partnerJobs = await getInProgressJobsForPartner(partnerId);
  const [jobTasks, personalTasks] = await Promise.all([
    getTasksForJobIds(partnerJobs.map((j) => j.id)),
    getTasksForStaff(partnerId),
  ]);
  return dedupeAndSortTasks([jobTasks, personalTasks]);
}

// Dispatches to the right scope for a staff member's own "My Work" board,
// based on their position in the Partner > Manager > Staff hierarchy --
// Partners get a practice-wide roll-up, Managers get their team's work,
// plain Staff get just their own board.
export async function getWorkBoardForStaff(staff: WorkflowStaff): Promise<TaskWithDetails[]> {
  switch (staff.role) {
    case "Partner":
      return getTasksForPartner(staff.id);
    case "Manager":
      return getTasksForManager(staff.id);
    default:
      return getTasksForStaff(staff.id);
  }
}

export async function listStatuses(): Promise<WorkflowStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("statuses")
    .select("id, name, color, sort_order, is_complete")
    .order("sort_order")
    .returns<StatusRow[]>();
  if (error) {
    console.error("[workflow] listStatuses failed:", error.message);
    return [];
  }
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    sortOrder: s.sort_order,
    isComplete: s.is_complete,
  }));
}

export async function listTaskTypes(): Promise<WorkflowTaskType[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("task_types")
    .select("id, name, color, sort_order")
    .order("sort_order")
    .returns<TaskTypeRow[]>();
  if (error) {
    console.error("[workflow] listTaskTypes failed:", error.message);
    return [];
  }
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    sortOrder: t.sort_order,
  }));
}

export async function createTask(input: CreateTaskInput): Promise<{ id: string } | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("tasks")
    .insert({
      job_id: input.jobId,
      title: input.title,
      assignee_id: input.assigneeId ?? null,
      due_date: input.dueDate ?? null,
      start_date: input.startDate ?? null,
      status_id: input.statusId,
      type_id: input.typeId ?? null,
      recurrence: input.recurrence ?? "none",
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    console.error("[workflow] createTask failed:", error.message);
    return null;
  }
  return data;
}

// Hands a task to another staff member temporarily -- the task stays on
// assigneeId's (the owner's) board, but shows up on tempAssigneeId's board
// too, flagged as a temporary reassignment. Pass null to hand it back.
export async function reassignTaskTemporarily(
  taskId: string,
  tempAssigneeId: string | null
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("tasks")
    .update({
      temp_assignee_id: tempAssigneeId,
      temp_assigned_at: tempAssigneeId ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (error) {
    console.error("[workflow] reassignTaskTemporarily failed:", error.message);
    return false;
  }
  return true;
}

// Every task under every job attached to a given customer -- feeds the
// /clients drawer's task list.
export async function getTasksForCustomer(customerId: string): Promise<TaskWithDetails[]> {
  const admin = getSupabaseAdmin();
  const { data: jobs, error } = await admin.from("jobs").select("id").eq("customer_id", customerId).returns<
    { id: string }[]
  >();
  if (error) {
    console.error("[workflow] getTasksForCustomer failed:", error.message);
    return [];
  }
  return getTasksForJobIds((jobs ?? []).map((j) => j.id));
}

// Builds the /clients tile-grid summary for every customer: manager (from
// their job(s)) and task counts by tone. "Multiple" is shown for a client
// whose jobs have more than one distinct manager.
export async function getClientSummaries(): Promise<ClientSummary[]> {
  const admin = getSupabaseAdmin();
  const [{ data: customers, error: customersError }, { data: allTasks, error: tasksError }, lookups] =
    await Promise.all([
      admin.from("customers").select("id, xpm_client_id, name, partner_id").order("name").returns<CustomerRow[]>(),
      admin.from("tasks").select("*").returns<TaskRow[]>(),
      fetchLookupMaps(),
    ]);

  if (customersError) console.error("[workflow] getClientSummaries (customers) failed:", customersError.message);
  if (tasksError) console.error("[workflow] getClientSummaries (tasks) failed:", tasksError.message);

  const today = new Date().toISOString().slice(0, 10);
  const jobs = Array.from(lookups.jobsById.values());

  return (customers ?? []).map((c) => {
    const customerJobs = jobs.filter((j) => j.customer_id === c.id);
    const jobIds = new Set(customerJobs.map((j) => j.id));
    const managerIds = new Set(customerJobs.map((j) => j.manager_id).filter((id): id is string => Boolean(id)));

    let managerName: string | null = null;
    if (managerIds.size === 1) {
      managerName = lookups.staffById.get(Array.from(managerIds)[0])?.name ?? null;
    } else if (managerIds.size > 1) {
      managerName = "Multiple";
    }

    let overdueCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    for (const t of allTasks ?? []) {
      if (!jobIds.has(t.job_id)) continue;
      const isComplete = lookups.statusesById.get(t.status_id)?.is_complete ?? false;
      if (isComplete) completedCount += 1;
      else if (t.due_date && t.due_date < today) overdueCount += 1;
      else inProgressCount += 1;
    }

    return { id: c.id, name: c.name, managerName, overdueCount, inProgressCount, completedCount };
  });
}

interface CustomerNoteRow {
  id: string;
  customer_id: string;
  author_name: string;
  author_email: string | null;
  body: string;
  created_at: string;
}

function mapCustomerNote(row: CustomerNoteRow): CustomerNote {
  return {
    id: row.id,
    customerId: row.customer_id,
    authorName: row.author_name,
    authorEmail: row.author_email,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("customer_notes")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .returns<CustomerNoteRow[]>();

  if (error) {
    console.error("[workflow] getCustomerNotes failed:", error.message);
    return [];
  }
  return (data ?? []).map(mapCustomerNote);
}

export async function addCustomerNote(
  customerId: string,
  authorName: string,
  authorEmail: string | null,
  body: string
): Promise<CustomerNote | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("customer_notes")
    .insert({ customer_id: customerId, author_name: authorName, author_email: authorEmail, body })
    .select("*")
    .single<CustomerNoteRow>();

  if (error) {
    console.error("[workflow] addCustomerNote failed:", error.message);
    return null;
  }
  return mapCustomerNote(data);
}

interface CustomerFileRow {
  id: string;
  customer_id: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_by_name: string | null;
  uploaded_by_email: string | null;
  created_at: string;
}

const FILES_BUCKET = "client-files";
const SIGNED_URL_TTL_SECONDS = 600;

function mapCustomerFile(row: CustomerFileRow): CustomerFile {
  return {
    id: row.id,
    customerId: row.customer_id,
    fileName: row.file_name,
    storagePath: row.storage_path,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    uploadedByName: row.uploaded_by_name,
    uploadedByEmail: row.uploaded_by_email,
    createdAt: row.created_at,
  };
}

// Lists a customer's files with a fresh, time-limited signed download URL
// on each -- the bucket is private, so nothing is ever served unsigned.
export async function getCustomerFiles(customerId: string): Promise<CustomerFile[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("customer_files")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .returns<CustomerFileRow[]>();

  if (error) {
    console.error("[workflow] getCustomerFiles failed:", error.message);
    return [];
  }

  return Promise.all(
    (data ?? []).map(async (row) => {
      const file = mapCustomerFile(row);
      const { data: signed, error: signedError } = await admin.storage
        .from(FILES_BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
      if (signedError) {
        console.error("[workflow] createSignedUrl failed for", row.storage_path, signedError.message);
        return file;
      }
      return { ...file, downloadUrl: signed?.signedUrl };
    })
  );
}

// Uploads the file's bytes to Storage, then records its metadata. Returns
// null (and logs) if either step fails -- callers should treat that as a
// failed upload, not a partial one, since an orphaned storage object with
// no metadata row is harmless (just unreachable dead weight).
export async function uploadCustomerFile(
  customerId: string,
  file: File,
  uploadedByName: string,
  uploadedByEmail: string | null
): Promise<CustomerFile | null> {
  const admin = getSupabaseAdmin();
  const storagePath = `${customerId}/${crypto.randomUUID()}-${file.name}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(FILES_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || undefined });

  if (uploadError) {
    console.error("[workflow] uploadCustomerFile (storage) failed:", uploadError.message);
    return null;
  }

  const { data, error } = await admin
    .from("customer_files")
    .insert({
      customer_id: customerId,
      file_name: file.name,
      storage_path: storagePath,
      content_type: file.type || null,
      size_bytes: file.size,
      uploaded_by_name: uploadedByName,
      uploaded_by_email: uploadedByEmail,
    })
    .select("*")
    .single<CustomerFileRow>();

  if (error) {
    console.error("[workflow] uploadCustomerFile (metadata) failed:", error.message);
    return null;
  }
  return mapCustomerFile(data);
}
