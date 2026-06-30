import type { StaffMember, ClientTile, BasStatus, KpiData } from "@/types/dashboard";
import type { KarbonTask, KarbonWorkItem } from "@/types/karbon";

export const STAFF: StaffMember[] = [
  {
    id: "maria-santos",
    name: "Maria Santos",
    initials: "MS",
    xpmRole: "Manager",
    score: 91,
    billableHours: 22,
    nonBillableHours: 3,
    billablePct: 88,
    tasksDone: 14,
    tasksOverdue: 0,
    basOverdue: 0,
    dailyHours: [5.0, 4.5, 5.5, 5.0, 5.0],
    included: true,
  },
  {
    id: "jay-reyes",
    name: "Jay Reyes",
    initials: "JR",
    xpmRole: "Manager",
    score: 85,
    billableHours: 19.5,
    nonBillableHours: 4.5,
    billablePct: 81,
    tasksDone: 11,
    tasksOverdue: 1,
    basOverdue: 0,
    dailyHours: [4.5, 5.0, 5.0, 4.5, 5.0],
    included: true,
  },
  {
    id: "ana-cruz",
    name: "Ana Cruz",
    initials: "AC",
    xpmRole: "Manager",
    score: 79,
    billableHours: 17,
    nonBillableHours: 5,
    billablePct: 77,
    tasksDone: 9,
    tasksOverdue: 2,
    basOverdue: 1,
    dailyHours: [4.0, 4.5, 4.5, 4.5, 4.5],
    included: true,
  },
  {
    id: "ben-tan",
    name: "Ben Tan",
    initials: "BT",
    xpmRole: "Manager",
    score: 71,
    billableHours: 15,
    nonBillableHours: 6,
    billablePct: 71,
    tasksDone: 8,
    tasksOverdue: 2,
    basOverdue: 0,
    dailyHours: [4.0, 4.0, 4.5, 4.0, 4.5],
    included: true,
  },
  {
    id: "lia-garcia",
    name: "Lia Garcia",
    initials: "LG",
    xpmRole: "Manager",
    score: 64,
    billableHours: 13,
    nonBillableHours: 7,
    billablePct: 65,
    tasksDone: 6,
    tasksOverdue: 2,
    basOverdue: 1,
    dailyHours: [3.5, 4.0, 4.0, 4.0, 4.5],
    included: true,
  },
  {
    id: "marco-diaz",
    name: "Marco Diaz",
    initials: "MD",
    xpmRole: "Manager",
    score: 58,
    billableHours: 12,
    nonBillableHours: 8,
    billablePct: 60,
    tasksDone: 5,
    tasksOverdue: 3,
    basOverdue: 0,
    dailyHours: [3.5, 4.0, 4.0, 4.0, 4.5],
    included: false,
  },
];

interface ClientSeed {
  id: string;
  name: string;
  managerId: string;
  ytdInvoiced: number;
  ytdTarget: number;
  basStatus: BasStatus;
  revenueBreakdown: { label: string; value: number }[];
}

const CLIENT_SEEDS: ClientSeed[] = [
  {
    id: "smith-co",
    name: "Smith & Co",
    managerId: "maria-santos",
    ytdInvoiced: 18400,
    ytdTarget: 22000,
    basStatus: "lodged",
    revenueBreakdown: [
      { label: "Bookkeeping", value: 9800 },
      { label: "BAS", value: 4200 },
      { label: "Payroll", value: 2900 },
      { label: "Advisory", value: 1500 },
    ],
  },
  {
    id: "patel-medical",
    name: "Patel Medical",
    managerId: "jay-reyes",
    ytdInvoiced: 16700,
    ytdTarget: 16000,
    basStatus: "lodged",
    revenueBreakdown: [
      { label: "Bookkeeping", value: 10100 },
      { label: "BAS", value: 3800 },
      { label: "Payroll", value: 1800 },
      { label: "Tax", value: 1000 },
    ],
  },
  {
    id: "taylor-plumbing",
    name: "Taylor Plumbing",
    managerId: "ana-cruz",
    ytdInvoiced: 14200,
    ytdTarget: 15000,
    basStatus: "in-progress",
    revenueBreakdown: [
      { label: "Bookkeeping", value: 8200 },
      { label: "BAS", value: 3400 },
      { label: "Payroll", value: 2000 },
      { label: "Advisory", value: 600 },
    ],
  },
  {
    id: "mori-imports",
    name: "Mori Imports",
    managerId: "ben-tan",
    ytdInvoiced: 12300,
    ytdTarget: 13500,
    basStatus: "in-progress",
    revenueBreakdown: [
      { label: "Bookkeeping", value: 7400 },
      { label: "BAS", value: 2800 },
      { label: "Payroll", value: 1500 },
      { label: "Advisory", value: 600 },
    ],
  },
  {
    id: "nguyen-retail",
    name: "Nguyen Retail",
    managerId: "lia-garcia",
    ytdInvoiced: 11800,
    ytdTarget: 12000,
    basStatus: "lodged",
    revenueBreakdown: [
      { label: "Bookkeeping", value: 7200 },
      { label: "BAS", value: 2600 },
      { label: "Payroll", value: 1400 },
      { label: "Tax", value: 600 },
    ],
  },
  {
    id: "abc-tradie",
    name: "ABC Tradie Co",
    managerId: "maria-santos",
    ytdInvoiced: 10200,
    ytdTarget: 11000,
    basStatus: "not-started",
    revenueBreakdown: [
      { label: "Bookkeeping", value: 6100 },
      { label: "BAS", value: 2300 },
      { label: "Payroll", value: 1400 },
      { label: "Advisory", value: 400 },
    ],
  },
  {
    id: "lee-constructions",
    name: "Lee Constructions",
    managerId: "jay-reyes",
    ytdInvoiced: 8900,
    ytdTarget: 10000,
    basStatus: "not-started",
    revenueBreakdown: [
      { label: "Bookkeeping", value: 5400 },
      { label: "BAS", value: 2000 },
      { label: "Payroll", value: 1100 },
      { label: "Advisory", value: 400 },
    ],
  },
  {
    id: "harris-cafe",
    name: "Harris Cafe",
    managerId: "ana-cruz",
    ytdInvoiced: 7400,
    ytdTarget: 9000,
    basStatus: "lodged",
    revenueBreakdown: [
      { label: "Bookkeeping", value: 4400 },
      { label: "BAS", value: 1600 },
      { label: "Payroll", value: 1000 },
      { label: "Tax", value: 400 },
    ],
  },
];

let nextTaskId = 1;
function makeTask(
  title: string,
  assigneeId: string,
  clientId: string,
  category: string,
  dueDate: string,
  status: KarbonTask["status"],
  isOverdue: boolean,
): KarbonTask {
  const staff = STAFF.find((s) => s.id === assigneeId)!;
  const client = CLIENT_SEEDS.find((c) => c.id === clientId)!;
  return {
    id: "T" + nextTaskId++,
    title,
    assigneeId,
    assigneeName: staff.name,
    clientId,
    clientName: client.name,
    category,
    dueDate,
    status,
    isOverdue,
  };
}

export const TASKS: KarbonTask[] = [
  makeTask("Creditor reconciliation", "ana-cruz", "taylor-plumbing", "Bookkeeping", "2026-06-19", "inProgress", true),
  makeTask("Fixed asset schedule", "ana-cruz", "harris-cafe", "Tax", "2026-06-17", "inProgress", true),
  makeTask("Monthly report draft", "ben-tan", "mori-imports", "Bookkeeping", "2026-06-16", "inProgress", true),
  makeTask("Supplier queries", "ben-tan", "mori-imports", "Bookkeeping", "2026-06-15", "todo", true),
  makeTask("BAS lodgement — Taylor", "jay-reyes", "taylor-plumbing", "BAS", "2026-06-22", "inProgress", true),
  makeTask("Chart of accounts setup", "lia-garcia", "nguyen-retail", "Bookkeeping", "2026-06-17", "todo", true),
  makeTask("Receipt scanning backlog", "lia-garcia", "abc-tradie", "Bookkeeping", "2026-06-15", "todo", true),
  makeTask("Payroll run — Smith", "maria-santos", "smith-co", "Payroll", "2026-06-29", "todo", false),
  makeTask("BAS prep — Patel", "jay-reyes", "patel-medical", "BAS", "2026-06-30", "inProgress", false),
  makeTask("Bank rec — Nguyen", "lia-garcia", "nguyen-retail", "Bookkeeping", "2026-06-30", "todo", false),
  makeTask("Year-end review", "maria-santos", "smith-co", "Advisory", "2026-07-03", "todo", false),
  makeTask("Quarterly IAS — Mori", "ben-tan", "mori-imports", "BAS", "2026-07-04", "todo", false),
  makeTask("Super lodgement — ABC", "maria-santos", "abc-tradie", "Payroll", "2026-07-05", "todo", false),
  makeTask("Tax return draft — Lee", "jay-reyes", "lee-constructions", "Tax", "2026-07-02", "todo", false),
  makeTask("Receipt review — Harris", "ana-cruz", "harris-cafe", "Bookkeeping", "2026-06-26", "complete", false),
  makeTask("Bank rec — Patel", "jay-reyes", "patel-medical", "Bookkeeping", "2026-06-25", "complete", false),
  makeTask("BAS lodgement — Smith", "maria-santos", "smith-co", "BAS", "2026-06-24", "complete", false),
  makeTask("Payroll — Nguyen", "lia-garcia", "nguyen-retail", "Payroll", "2026-06-23", "complete", false),
];

export const WORK_ITEMS: KarbonWorkItem[] = CLIENT_SEEDS.map((c, i) => ({
  id: "W" + (i + 1),
  clientId: c.id,
  clientName: c.name,
  type: "BAS",
  status:
    c.basStatus === "lodged"
      ? "complete"
      : c.basStatus === "in-progress"
        ? "inProgress"
        : "notStarted",
  dueDate: "2026-06-28",
  assigneeId: c.managerId,
  assigneeName: STAFF.find((s) => s.id === c.managerId)!.name,
}));

export const CLIENT_TILES: ClientTile[] = CLIENT_SEEDS.map((c) => {
  const manager = STAFF.find((s) => s.id === c.managerId)!;
  const clientTasks = TASKS.filter((t) => t.clientId === c.id);
  return {
    id: c.id,
    name: c.name,
    managerId: c.managerId,
    managerName: manager.name,
    ytdInvoiced: c.ytdInvoiced,
    ytdTarget: c.ytdTarget,
    overdueTasks: clientTasks.filter((t) => t.isOverdue),
    inProgressTasks: clientTasks.filter((t) => t.status === "inProgress" && !t.isOverdue),
    completedTasks: clientTasks.filter((t) => t.status === "complete"),
    basStatus: c.basStatus,
    revenueBreakdown: c.revenueBreakdown,
  };
});

export const KPI: KpiData = {
  billableHoursToday: 86.5,
  tasksOverdue: TASKS.filter((t) => t.isOverdue).length,
  basLodged: CLIENT_SEEDS.filter((c) => c.basStatus === "lodged").length,
  basTotal: CLIENT_SEEDS.length,
  teamUtilisation: 76,
};

export const WEEKLY_TREND = [
  { week: "Wk 20", billable: 74, nonBillable: 26, available: 120 },
  { week: "Wk 21", billable: 78, nonBillable: 22, available: 120 },
  { week: "Wk 22", billable: 82, nonBillable: 18, available: 120 },
  { week: "Wk 23", billable: 71, nonBillable: 24, available: 120 },
  { week: "Wk 24", billable: 85, nonBillable: 15, available: 120 },
  { week: "Wk 25", billable: 88, nonBillable: 12, available: 120 },
  { week: "Wk 26", billable: 84, nonBillable: 16, available: 120 },
  { week: "Wk 27", billable: 91.5, nonBillable: 18.5, available: 120 },
];

export const includedStaff = (): StaffMember[] => STAFF.filter((s) => s.included);

export const findStaff = (id: string): StaffMember | undefined =>
  STAFF.find((s) => s.id === id);
