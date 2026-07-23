// Types for the XPM-native work-item system that replaces Karbon (see
// lib/workflow.ts). staff/customers/jobs mirror XPM's Partner -> Client ->
// Job hierarchy; tasks are dashboard-native (not synced from anywhere).

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

export interface JobWithCustomer extends WorkflowJob {
  customerName: string;
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
  jobId: string;
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
}

// A task, hydrated with everything a board/list view needs to render
// without further lookups.
export interface TaskWithDetails extends WorkflowTask {
  jobName: string;
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
  jobId: string;
  title: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  statusId: string;
  typeId?: string | null;
  recurrence?: RecurrenceInterval;
}

// Same shape as CreateTaskInput but every field optional -- PATCH only
// touches fields actually present in the request body, so e.g. omitting
// jobId leaves a task on its existing job rather than clearing it.
export interface UpdateTaskInput {
  jobId?: string;
  title?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  statusId?: string;
  typeId?: string | null;
  recurrence?: RecurrenceInterval;
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
  // Every distinct staff id managing one of this client's jobs -- lets the
  // Clients page filter by a single staff member even when managerName
  // shows "Multiple".
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
