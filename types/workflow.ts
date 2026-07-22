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
