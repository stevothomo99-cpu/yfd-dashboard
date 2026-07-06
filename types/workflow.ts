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

// Managed list (Admin page), e.g. Bookkeeping / BAS-IAS / Payroll / Tax —
// replaces the earlier free-text task "type" field.
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
  typeId: string;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  statusId: string;
  recurrence: TaskRecurrence;
  recurrenceParentId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Denormalized view joining job/customer/staff/status/type — what the UI renders.
export interface WorkflowTaskView extends WorkflowTask {
  jobName: string;
  customerId: string;
  customerName: string;
  partnerId: string | null;
  managerId: string | null;
  assigneeName: string | null;
  status: WorkflowStatus;
  type: WorkflowTaskType;
}

export interface CreateTaskInput {
  jobId: string;
  title: string;
  typeId: string;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  statusId: string;
  recurrence: TaskRecurrence;
}

export interface CreateJobInput {
  customerId: string;
  name: string;
  partnerId: string | null;
  managerId: string | null;
}
