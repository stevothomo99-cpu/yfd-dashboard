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
  isOverdue: boolean;
}

export type KarbonWorkStatus = "notStarted" | "inProgress" | "complete";

export interface KarbonWorkItem {
  id: string;
  clientId: string;
  clientName: string;
  type: string;
  status: KarbonWorkStatus;
  dueDate: string;
  assigneeId: string;
  assigneeName: string;
}
