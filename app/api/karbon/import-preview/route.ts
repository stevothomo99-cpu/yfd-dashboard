import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  fetchAllKarbonWorkItemsRaw,
  fetchKarbonWorkSchedule,
  isKarbonConfigured,
  KarbonNotConfiguredError,
} from "@/lib/karbon";
import {
  defaultOpenStatusId,
  getPartners,
  getStaffByEmail,
  listStaff,
  listStatuses,
  listTaskTypes,
  searchClientsForPartner,
} from "@/lib/workflow";
import type { RecurrenceInterval, WorkflowCustomer, WorkflowStaff, WorkflowStatus, WorkflowTaskType } from "@/types/workflow";
import { TASKS } from "@/lib/mock";

interface ImportRow {
  workItemKey: string;
  title: string;
  dueDate: string | null;
  startDate: string | null;
  karbonClientName: string;
  karbonAssigneeName: string;
  karbonWorkType: string;
  karbonStatus: string;
  karbonRecurrenceFrequency: string | null;
  // customerId is the one field this route never guesses past an exact name
  // match -- a task can't be saved without a valid customer, so an unmatched
  // ClientName is left null and flagged for the person running the import to
  // resolve by hand via a dropdown, rather than silently defaulted.
  customerId: string | null;
  needsClient: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeIsFallback: boolean;
  statusId: string | null;
  statusName: string | null;
  typeId: string | null;
  typeName: string | null;
  recurrence: RecurrenceInterval;
}

interface ImportPreviewResponse {
  mode: "live" | "mock";
  rows: ImportRow[];
  customers: { id: string; name: string }[];
  message?: string;
}

// Karbon's raw field names, built from the same mock tasks the rest of the
// app falls back to when KARBON_API_KEY is unset -- so the mapping page has
// something plausible to render even without live access. One row is given
// a WorkScheduleKey + RecurrenceFrequency so the mock also demonstrates what
// a recurring WorkItem looks like once its schedule is joined in.
function mockRawRows(): Record<string, unknown>[] {
  return TASKS.map((t, i) => ({
    WorkItemKey: t.id,
    Title: t.title,
    ClientKey: t.clientId,
    ClientName: t.clientName,
    AssigneeKey: t.assigneeId,
    AssigneeName: t.assigneeName,
    WorkType: t.category,
    DueDate: t.dueDate,
    PrimaryStatus: t.rawStatus,
    WorkScheduleKey: i === 0 ? "SCHED-MOCK-1" : null,
    ...(i === 0 ? { RecurrenceFrequency: "Monthly" } : {}),
  }));
}

// Recurrence lives on WorkSchedules, not on the WorkItem row itself -- see
// fetchKarbonWorkSchedule's comment. A WorkItem with no WorkScheduleKey is a
// one-off and is returned unchanged; only fields worth mapping are copied
// over, not the whole schedule object.
async function withScheduleFrequency(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  return Promise.all(
    rows.map(async (row) => {
      const scheduleKey = row.WorkScheduleKey;
      if (typeof scheduleKey !== "string" || !scheduleKey) return row;
      const schedule = await fetchKarbonWorkSchedule(scheduleKey);
      if (!schedule || !("RecurrenceFrequency" in schedule)) return row;
      return { ...row, RecurrenceFrequency: schedule.RecurrenceFrequency };
    }),
  );
}

function pickStr(obj: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return fallback;
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 10) return null;
  return value.slice(0, 10);
}

// Pulling every WorkItem with no date bound (see fetchAllKarbonWorkItemsRaw)
// means years of Karbon's closed-out history comes back alongside current
// work -- completed items dominate that history and aren't what a one-off
// import into a live task board is for, whether they were a one-off job or
// a past occurrence of a recurring one. Matched purely on Karbon's own
// PrimaryStatus string, not on the internal status match, so this still
// works even for a tenant whose "Completed"-equivalent status is named
// differently internally.
function isCompletedKarbonStatus(raw: unknown): boolean {
  return typeof raw === "string" && raw.toLowerCase().replace(/\s+/g, "") === "completed";
}

// Loose enough to survive Karbon vs. internal spelling differences ("In
// Progress" vs "InProgress") without over-matching unrelated names.
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

function mapRecurrence(freq: unknown): RecurrenceInterval {
  if (typeof freq !== "string") return "none";
  const s = freq.toLowerCase();
  if (s.includes("fortnight") || s.includes("2 week") || s.includes("biweek")) return "fortnightly";
  if (s.includes("day")) return "daily";
  if (s.includes("week")) return "weekly";
  if (s.includes("quarter")) return "quarterly";
  if (s.includes("month")) return "monthly";
  return "none";
}

interface ReferenceData {
  customers: WorkflowCustomer[];
  staffByName: Map<string, WorkflowStaff>;
  statusByName: Map<string, WorkflowStatus>;
  typeByName: Map<string, WorkflowTaskType>;
  customerByName: Map<string, WorkflowCustomer>;
  fallbackAssigneeId: string | null;
  fallbackAssigneeName: string | null;
  defaultStatusId: string | null;
  defaultStatusName: string | null;
}

// Mirrors how app/(dashboard)/my-work/page.tsx builds its admin-wide client
// list (there's no single "all customers" helper in lib/workflow.ts --
// customers are always scoped by partner) so an unmatched WorkItem's client
// dropdown offers the full practice roster, not just one partner's slice.
async function loadReferenceData(email: string | null | undefined): Promise<ReferenceData> {
  const [partners, staff, statuses, taskTypes, sessionStaff, statusId] = await Promise.all([
    getPartners(),
    listStaff(),
    listStatuses(),
    listTaskTypes(),
    email ? getStaffByEmail(email) : Promise.resolve(null),
    defaultOpenStatusId(),
  ]);

  const clientsByPartner = await Promise.all(partners.map((p) => searchClientsForPartner(p.id)));
  const customersById = new Map<string, WorkflowCustomer>();
  for (const clients of clientsByPartner) for (const c of clients) customersById.set(c.id, c);
  const customers = Array.from(customersById.values());
  const defaultStatus = statuses.find((s) => s.id === statusId) ?? null;

  return {
    customers,
    staffByName: new Map(staff.map((s) => [normalize(s.name), s])),
    statusByName: new Map(statuses.map((s) => [normalize(s.name), s])),
    typeByName: new Map(taskTypes.map((t) => [normalize(t.name), t])),
    customerByName: new Map(customers.map((c) => [normalize(c.name), c])),
    fallbackAssigneeId: sessionStaff?.id ?? null,
    fallbackAssigneeName: sessionStaff?.name ?? null,
    defaultStatusId: statusId,
    defaultStatusName: defaultStatus?.name ?? null,
  };
}

// Every field except customerId gets a safe fallback so an unmatched
// assignee/type/status never blocks the row -- it lands on the importing
// admin (assigneeIsFallback flags this so it's visible, not silent) with the
// default open status, ready to be reassigned or deleted afterwards. Client
// has no safe fallback (a task can't exist without one), so it's left null
// and the row is flagged needsClient for manual resolution instead.
function buildRows(rawRows: Record<string, unknown>[], ref: ReferenceData): ImportRow[] {
  return rawRows.map((w) => {
    const karbonClientName = pickStr(w, ["ClientName"]);
    const karbonAssigneeName = pickStr(w, ["AssigneeName"]);
    const karbonWorkType = pickStr(w, ["WorkType"]);
    const karbonStatus = pickStr(w, ["PrimaryStatus"]);
    const matchedCustomer = ref.customerByName.get(normalize(karbonClientName));
    const matchedStaff = ref.staffByName.get(normalize(karbonAssigneeName));
    const matchedStatus = ref.statusByName.get(normalize(karbonStatus));
    const matchedType = ref.typeByName.get(normalize(karbonWorkType));

    return {
      workItemKey: pickStr(w, ["WorkItemKey"]),
      title: pickStr(w, ["Title"], "(untitled)"),
      dueDate: dateOnly(w.DueDate),
      startDate: dateOnly(w.StartDate),
      karbonClientName,
      karbonAssigneeName,
      karbonWorkType,
      karbonStatus,
      karbonRecurrenceFrequency: typeof w.RecurrenceFrequency === "string" ? w.RecurrenceFrequency : null,
      customerId: matchedCustomer?.id ?? null,
      needsClient: !matchedCustomer,
      assigneeId: matchedStaff?.id ?? ref.fallbackAssigneeId,
      assigneeName: matchedStaff?.name ?? ref.fallbackAssigneeName,
      assigneeIsFallback: !matchedStaff,
      statusId: matchedStatus?.id ?? ref.defaultStatusId,
      statusName: matchedStatus?.name ?? ref.defaultStatusName,
      typeId: matchedType?.id ?? null,
      typeName: matchedType?.name ?? null,
      recurrence: mapRecurrence(w.RecurrenceFrequency),
    };
  });
}

// Admin-only, same as the Karbon Import page itself -- this is a review tool
// for setting up an import, not something every staff login needs.
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  let ref: ReferenceData;
  try {
    ref = await loadReferenceData(session.user.email);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { mode: "live", rows: [], customers: [], message: `Failed to load internal reference data: ${message}` } satisfies ImportPreviewResponse,
      { status: 502 },
    );
  }
  const customerOptions = [...ref.customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name }));

  if (!isKarbonConfigured()) {
    return NextResponse.json({
      mode: "mock",
      rows: buildRows(mockRawRows().filter((w) => !isCompletedKarbonStatus(w.PrimaryStatus)), ref),
      customers: customerOptions,
      message: "Showing mock data because KARBON_API_KEY is not set.",
    } satisfies ImportPreviewResponse);
  }

  try {
    const allRaw = await fetchAllKarbonWorkItemsRaw();
    const active = allRaw.filter((w) => !isCompletedKarbonStatus(w.PrimaryStatus));
    // Temporary diagnostic: the completed-status filter is dropping every
    // row in production and it isn't obvious yet whether that's because
    // every fetched WorkItem is genuinely "Completed" or because
    // PrimaryStatus comes back in a shape isCompletedKarbonStatus doesn't
    // recognize. Remove once confirmed.
    console.log(
      "[karbon-import] fetched",
      allRaw.length,
      "raw, ",
      active.length,
      "non-completed. Sample PrimaryStatus values:",
      JSON.stringify(Array.from(new Set(allRaw.slice(0, 50).map((w) => w.PrimaryStatus)))),
    );
    const raw = await withScheduleFrequency(active);
    return NextResponse.json({ mode: "live", rows: buildRows(raw, ref), customers: customerOptions } satisfies ImportPreviewResponse);
  } catch (err) {
    if (err instanceof KarbonNotConfiguredError) {
      return NextResponse.json({
        mode: "mock",
        rows: buildRows(mockRawRows().filter((w) => !isCompletedKarbonStatus(w.PrimaryStatus)), ref),
        customers: customerOptions,
        message: err.message,
      } satisfies ImportPreviewResponse);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { mode: "live", rows: [], customers: customerOptions, message } satisfies ImportPreviewResponse,
      { status: 502 },
    );
  }
}
