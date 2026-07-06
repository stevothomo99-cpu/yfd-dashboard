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

export type TaskRecurrence = "none" | "daily" | "weekly" | "fortnightly" | "monthly" | "quarterly";

export interface WorkflowStatus {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isComplete: boolean;
}

export interface WorkflowTask {
  id: string;
  jobId: string;
  title: string;
  type: string;
  assigneeId: string | null;
  dueDate: string | null;
  statusId: string;
  recurrence: TaskRecurrence;
  recurrenceParentId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Denormalized view joining job/customer/staff/status — what the UI renders.
export interface WorkflowTaskView extends WorkflowTask {
  jobName: string;
  customerId: string;
  customerName: string;
  partnerId: string | null;
  managerId: string | null;
  assigneeName: string | null;
  status: WorkflowStatus;
}

export interface CreateTaskInput {
  jobId: string;
  title: string;
  type: string;
  assigneeId: string | null;
  dueDate: string | null;
  statusId: string;
  recurrence: TaskRecurrence;
}

// Free-text, but these are the common categories staff already use in
// Karbon/XPM — offered as <datalist> suggestions, not an enforced enum.
export const TASK_TYPE_SUGGESTIONS = [
  "Bookkeeping",
  "BAS/IAS",
  "Payroll",
  "Tax",
  "Advisory",
  "Month-end close",
  "General",
];

export interface CreateJobInput {
  customerId: string;
  name: string;
  partnerId: string | null;
  managerId: string | null;
}
