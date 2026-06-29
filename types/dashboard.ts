import type { KarbonTask } from "./karbon";

export interface StaffMember {
  id: string;
  name: string;
  initials: string;
  xpmRole: string;
  score: number;
  billableHours: number;
  nonBillableHours: number;
  billablePct: number;
  tasksDone: number;
  tasksOverdue: number;
  basOverdue: number;
  dailyHours: number[];
  included: boolean;
}

export type BasStatus = "lodged" | "in-progress" | "not-started";

export interface ClientTile {
  id: string;
  name: string;
  managerId: string;
  managerName: string;
  ytdInvoiced: number;
  ytdTarget: number;
  overdueTasks: KarbonTask[];
  inProgressTasks: KarbonTask[];
  completedTasks: KarbonTask[];
  basStatus: BasStatus;
  revenueBreakdown: { label: string; value: number }[];
}

export interface KpiData {
  billableHoursToday: number;
  tasksOverdue: number;
  basLodged: number;
  basTotal: number;
  teamUtilisation: number;
}

export type PeriodFilter = "week" | "month" | "ytd";
