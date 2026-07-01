export type KarbonTaskStatus = "todo" | "inProgress" | "complete";

export interface KarbonTask {
  id: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  clientId: string;
  clientName: string;
  category: string;
  dueDate: string;
  status: KarbonTaskStatus;
  // Karbon's actual PrimaryStatus string (e.g. "Planned", "Ready To Start",
  // "In Progress", "Waiting", "Completed") — the 3-value `status` above
  // collapses these for KPI counts, but filtering needs the real values.
  rawStatus: string;
  isOverdue: boolean;
}

export type KarbonWorkStatus = "notStarted" | "inProgress" | "complete";

export interface KarbonWorkItem {
  id: string;
  clientId: string;
  clientName: string;
  type: string;
  status: KarbonWorkStatus;
  rawStatus: string;
  dueDate: string;
  assigneeId: string;
  assigneeName: string;
}

// The canonical Karbon identity for a person — independent of whether they
// currently have any tasks/work items assigned. Email is the join key to
// XPM staff (same person, same email, in both systems).
export interface KarbonUser {
  id: string;
  name: string;
  email: string;
}
