// Types for the XPM-native work-item system that replaces Karbon (see
// lib/workflow.ts). staff/customers/jobs mirror XPM's Partner -> Client ->
// Job hierarchy; tasks are dashboard-native (not synced from anywhere).
//
// Tasks belong to a CLIENT, not a job -- confirmed directly with the
// practice: time is captured against jobs in XPM and jobs are billed to
// clients, which is the only place jobs are used. Workflow/tasks are
// recorded against clients (see migration 017). Jobs still exist here for
// XPM/billing reference (WorkflowJob, JobWithManager, the Clients drawer's
// Jobs section) but a Task never references one.

export type StaffRole = "Partner" | "Manager" | "Staff";

export interface WorkflowStaff {
  id: string;
  xpmStaffId: string | null;
  name: string;
  email: string;
  role: StaffRole;
  included: boolean;
}

export interface WorkflowCustomer {
  id: string;
  xpmClientId: string | null;
  name: string;
  partnerId: string | null;
}

export interface WorkflowJob {
  id: string;
  customerId: string;
  xpmJobId: string | null;
  name: string;
  partnerId: string | null;
  managerId: string | null;
}

export interface JobWithManager extends WorkflowJob {
  managerName: string | null;
}

export type RecurrenceInterval =
  | "none"
  | "daily"
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "quarterly";

export interface WorkflowStatus {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isComplete: boolean;
}

export interface WorkflowTaskType {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface WorkflowTask {
  id: string;
  customerId: string;
  title: string;
  assigneeId: string | null;
  tempAssigneeId: string | null;
  tempAssignedAt: string | null;
  dueDate: string | null;
  startDate: string | null;
  statusId: string;
  typeId: string | null;
  recurrence: RecurrenceInterval;
  recurrenceParentId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Set only when this task was created by Karbon Import -- the client name
  // Karbon itself reported for the WorkItem, kept as a reference point for
  // spotting a wrong client match after the fact. Null for every task
  // created any other way.
  karbonClientName: string | null;
  // Free-text notes/description on the task, set from the create/edit
  // modal's "Details" field. Null for most tasks -- see migration 020.
  details: string | null;
  // BAS/IAS approval-pipeline stage (see migration 022 and /bas-status).
  // null = "Pending" (unset/default); only meaningful for BAS/IAS-typed
  // tasks, but stored as a plain generic column -- see the migration's
  // comment.
  basStage: "ready_for_approval" | "waiting_on_customer" | null;
}

// A task, hydrated with everything a board/list view needs to render
// without further lookups.
export interface TaskWithDetails extends WorkflowTask {
  customerName: string;
  statusName: string;
  statusColor: string;
  statusIsComplete: boolean;
  typeName: string | null;
  typeColor: string | null;
  assigneeName: string | null;
  tempAssigneeName: string | null;
  // true when temp_assignee_id is set and differs from assignee_id -- the
  // task is currently on someone else's plate but still belongs to
  // assigneeId's board.
  isTemporarilyReassigned: boolean;
  isOverdue: boolean;
}

export interface CreateTaskInput {
  customerId: string;
  title: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  statusId: string;
  typeId?: string | null;
  recurrence?: RecurrenceInterval;
  karbonClientName?: string | null;
  details?: string | null;
}

// Same shape as CreateTaskInput but every field optional -- PATCH only
// touches fields actually present in the request body, so e.g. omitting
// customerId leaves a task on its existing client rather than clearing it.
export interface UpdateTaskInput {
  customerId?: string;
  title?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  statusId?: string;
  typeId?: string | null;
  recurrence?: RecurrenceInterval;
  details?: string | null;
}

// Summary card data for the /clients tile grid, built from customers/jobs/
// tasks -- replaces the old Karbon-derived ClientTile mock data. YTD
// invoiced/revenue-breakdown aren't included: those depend on XPM invoice
// data being linked via customers.xpm_client_id, which isn't wired up yet.
export interface ClientSummary {
  id: string;
  xpmClientId: string | null;
  name: string;
  managerName: string | null;
  // The client's Manager id, as a list purely so the Clients page filter
  // can stay a simple `includes` check. Holds at most one id -- a client has
  // one Manager in XPM (its jobManager); this is not an aggregate over its
  // jobs' managers.
  managerIds: string[];
  overdueCount: number;
  inProgressCount: number;
  completedCount: number;
  // Overdue tasks specifically typed BAS/IAS, out of overdueCount -- the
  // single most operationally important thing to surface per client.
  overdueBasCount: number;
  // Soonest due date among this client's non-complete tasks, if any.
  nextDueDate: string | null;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  title: string | null;
  authorName: string;
  authorEmail: string | null;
  body: string;
  pinned: boolean;
  createdAt: string;
}

export interface CustomerFile {
  id: string;
  customerId: string;
  fileName: string;
  storagePath: string;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedByName: string | null;
  uploadedByEmail: string | null;
  createdAt: string;
  // Only populated when listing -- a fresh, time-limited signed URL, not
  // stored anywhere (the bucket is private).
  downloadUrl?: string;
}

// A reusable, named set of tasks (title/type/recurrence only -- see
// migrations/008_task_templates.sql) that can be applied to any job to
// bulk-create fresh, unscheduled, unassigned tasks from it.
export interface TaskTemplateItem {
  id: string;
  templateId: string;
  title: string;
  typeId: string | null;
  typeName: string | null;
  typeColor: string | null;
  recurrence: RecurrenceInterval;
  sortOrder: number;
}

export interface TaskTemplateSummary {
  id: string;
  name: string;
  createdAt: string;
  itemCount: number;
}

export interface TaskTemplateWithItems extends TaskTemplateSummary {
  items: TaskTemplateItem[];
}

export type TodoItemStatus = "pending_triage" | "todo" | "done" | "converted";

// Created by forwarding an email to the shared inbound address (see
// app/api/email/inbound/route.ts) -- lighter-weight than a Task (no job,
// status, or type), for one-off reminders. "pending_triage" means the
// owner hasn't yet set a client/due date; "todo"/"done" are populated
// one-off items; "converted" means it was turned into a real Task instead
// (see lib/todos.ts's populateTodoItem) because it turned out to be
// recurring work.
export interface TodoItem {
  id: string;
  ownerStaffId: string;
  createdByEmail: string | null;
  createdByName: string | null;
  // The forwarded email's original Subject header -- immutable, and the
  // record of where this item came from.
  subject: string;
  // Owner-supplied display name, null until they rename it. Read through
  // todoDisplayName() rather than directly, so the subject fallback is
  // applied consistently.
  title: string | null;
  body: string | null;
  customerId: string | null;
  customerName: string | null;
  dueDate: string | null;
  status: TodoItemStatus;
  convertedTaskId: string | null;
  createdAt: string;
}
