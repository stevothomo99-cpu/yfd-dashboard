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
