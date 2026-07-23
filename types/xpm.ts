export type XpmRole = "Manager" | "Partner" | "Staff";

export interface XpmStaff {
  id: string;
  name: string;
  email: string;
  role: XpmRole;
  included: boolean;
}

export interface XpmTimesheet {
  staffId: string;
  date: string;
  hours: number;
  billable: boolean;
  clientId: string;
  jobId: string;
  // The XPM task this entry was logged against within its job (e.g. "YFD -
  // Leave", "YFD - Idle", or a client job's own task name) -- distinguishes
  // Leave from other non-billable internal work.
  taskName: string | null;
}

export type XpmServiceType =
  | "Bookkeeping"
  | "Tax"
  | "Payroll"
  | "BAS"
  | "Advisory";

export interface XpmInvoice {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  date: string;
  serviceType: XpmServiceType;
  fyYear: number;
}
