import { cacheGet, cacheSet } from "./cache";
import type {
  KarbonTask,
  KarbonTaskStatus,
  KarbonWorkItem,
  KarbonWorkStatus,
  KarbonUser,
} from "@/types/karbon";

const TASKS_KEY = "karbon:tasks";
const WORK_KEY = "karbon:work";
const USERS_KEY = "karbon:users";
const TASKS_TTL = 5 * 60;
const WORK_TTL = 10 * 60;
const USERS_TTL = 24 * 60 * 60;
const PAGE_SIZE = 100;
// Without a date bound, /WorkItems pages through the tenant's full history
// (back to 2021), so we scope every fetch to a recent rolling window.
//
// This filters on DueDate, not StartDate: work that hasn't started yet
// typically has no StartDate set at all, so a StartDate-based filter
// silently excludes exactly the "not started" items this dashboard most
// needs to surface (confirmed live: a StartDate filter produced 100/0/0
// lodged/in-progress/not-started, and zero tasks at all on /tasks).
// DueDate is populated regardless of status and already drives this app's
// overdue/due-today/due-this-week logic, so it's the right anchor.
const RECENT_WINDOW_DAYS = 90;

function baseUrl(): string {
  return process.env.KARBON_BASE_URL ?? "https://api.karbonhq.com/v3";
}

export class KarbonNotConfiguredError extends Error {
  constructor() {
    super("KARBON_API_KEY is not set.");
    this.name = "KarbonNotConfiguredError";
  }
}

export function isKarbonConfigured(): boolean {
  return Boolean(process.env.KARBON_API_KEY);
}

// Accepts either a path ("/WorkItems?...") or an absolute URL, since Karbon's
// OData @odata.nextLink is returned as a full URL for pagination.
async function karbonFetch<T>(pathOrUrl: string, init?: RequestInit): Promise<T> {
  if (!isKarbonConfigured()) throw new KarbonNotConfiguredError();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${process.env.KARBON_API_KEY}`);
  headers.set("Accept", "application/json");
  // Karbon v3 also requires an AccessKey header alongside the bearer token.
  if (process.env.KARBON_ACCESS_KEY) {
    headers.set("AccessKey", process.env.KARBON_ACCESS_KEY);
  }
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : baseUrl() + pathOrUrl;
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Karbon ${pathOrUrl} failed: ${res.status} ${body}`);
  }
  return (await res.json()) as T;
}

interface ODataList<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

// Karbon v3 has a single work-tracking resource (/WorkItems) — there is no
// separate Tasks endpoint. Both "tasks" and "BAS work" views in this app are
// derived from WorkItems, optionally narrowed by an OData $filter.
async function fetchAllWorkItems(filter?: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let next: string | undefined =
    `/WorkItems?$top=${PAGE_SIZE}` + (filter ? `&$filter=${encodeURIComponent(filter)}` : "");
  while (next) {
    const url: string = next;
    const page: ODataList<Record<string, unknown>> = await karbonFetch(url);
    rows.push(...page.value);
    next = page["@odata.nextLink"];
  }
  return rows;
}

// /Users is confirmed to exist in Karbon's public OpenAPI spec (GET /v3/Users)
// but the exact field names weren't resolvable from the spec file directly —
// it's too large to fetch in full. Field lookup below tries the same naming
// conventions Karbon uses elsewhere (WorkItems' AssigneeKey/AssigneeName/
// AssigneeEmailAddress, minus the "Assignee" prefix) and degrades to an
// empty string rather than throwing — verify against real tenant data once
// this is live.
async function fetchAllUsers(): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let next: string | undefined = `/Users?$top=${PAGE_SIZE}`;
  while (next) {
    const url: string = next;
    const page: ODataList<Record<string, unknown>> = await karbonFetch(url);
    rows.push(...page.value);
    next = page["@odata.nextLink"];
  }
  return rows;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Karbon's OpenAPI spec gives unquoted date literals, e.g. "DueDate ge 2024-01-01".
// No upper bound — future-dated work (due next week, next quarter, etc.)
// should still show up.
function recentWindowFilter(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - RECENT_WINDOW_DAYS);
  return `DueDate ge ${d.toISOString().slice(0, 10)}`;
}

function combineFilters(...filters: (string | undefined)[]): string {
  return filters.filter((f): f is string => Boolean(f)).join(" and ");
}

function dateOnly(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, 10);
}

function pickStr(obj: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return fallback;
}

// PrimaryStatus enum values are "Planned" | "ReadyToStart" | "InProgress" |
// "Waiting" | "Completed", but Karbon's own docs note the API sometimes
// renders these with spaces ("Ready To Start"). Normalize before matching.
function normalizeStatus(raw: unknown): string {
  return typeof raw === "string" ? raw.toLowerCase().replace(/\s+/g, "") : "";
}

function mapTaskStatus(raw: unknown): KarbonTaskStatus {
  const norm = normalizeStatus(raw);
  if (norm === "completed") return "complete";
  if (norm === "inprogress" || norm === "waiting") return "inProgress";
  return "todo";
}

function mapWorkStatus(raw: unknown): KarbonWorkStatus {
  const norm = normalizeStatus(raw);
  if (norm === "completed") return "complete";
  if (norm === "inprogress" || norm === "waiting") return "inProgress";
  return "notStarted";
}

export async function fetchKarbonTasks(): Promise<KarbonTask[]> {
  const rows = await fetchAllWorkItems(recentWindowFilter());
  const today = todayIsoDate();

  return rows.map((w) => {
    const dueDate = dateOnly(w.DueDate);
    const status = mapTaskStatus(w.PrimaryStatus);
    return {
      id: pickStr(w, ["WorkItemKey"]),
      title: pickStr(w, ["Title"]),
      assigneeId: pickStr(w, ["AssigneeKey", "AssigneeEmailAddress"]),
      assigneeName: pickStr(w, ["AssigneeName"]),
      clientId: pickStr(w, ["ClientKey"]),
      clientName: pickStr(w, ["ClientName"]),
      category: pickStr(w, ["WorkType"]),
      dueDate,
      status,
      isOverdue: dueDate !== "" && dueDate < today && status !== "complete",
    } satisfies KarbonTask;
  });
}

// Narrows WorkItems to a specific WorkType (e.g. BAS lodgements). The exact
// label is tenant-specific — set KARBON_BAS_WORK_TYPE to match what's
// configured in Karbon's Work Type settings. Falls back to returning all
// WorkItems when unset.
export async function fetchKarbonWorkItems(): Promise<KarbonWorkItem[]> {
  const workType = process.env.KARBON_BAS_WORK_TYPE;
  const filter = combineFilters(
    recentWindowFilter(),
    workType ? `WorkType eq '${workType}'` : undefined,
  );
  const rows = await fetchAllWorkItems(filter);

  return rows.map((w) => ({
    id: pickStr(w, ["WorkItemKey"]),
    clientId: pickStr(w, ["ClientKey"]),
    clientName: pickStr(w, ["ClientName"]),
    type: pickStr(w, ["WorkType"]),
    status: mapWorkStatus(w.PrimaryStatus),
    dueDate: dateOnly(w.DueDate),
    assigneeId: pickStr(w, ["AssigneeKey", "AssigneeEmailAddress"]),
    assigneeName: pickStr(w, ["AssigneeName"]),
  }));
}

export async function getKarbonTasks(
  excludedStaffIds: string[] = [],
  options: { forceRefresh?: boolean } = {},
): Promise<KarbonTask[]> {
  if (!options.forceRefresh) {
    const hit = await cacheGet<KarbonTask[]>(TASKS_KEY);
    if (hit) return hit.filter((t) => !excludedStaffIds.includes(t.assigneeId));
  }
  const fresh = await fetchKarbonTasks();
  await cacheSet(TASKS_KEY, fresh, TASKS_TTL);
  return fresh.filter((t) => !excludedStaffIds.includes(t.assigneeId));
}

export async function getKarbonWorkItems(
  excludedStaffIds: string[] = [],
  options: { forceRefresh?: boolean } = {},
): Promise<KarbonWorkItem[]> {
  if (!options.forceRefresh) {
    const hit = await cacheGet<KarbonWorkItem[]>(WORK_KEY);
    if (hit) return hit.filter((w) => !excludedStaffIds.includes(w.assigneeId));
  }
  const fresh = await fetchKarbonWorkItems();
  await cacheSet(WORK_KEY, fresh, WORK_TTL);
  return fresh.filter((w) => !excludedStaffIds.includes(w.assigneeId));
}

// The canonical staff roster — every Karbon user, not just whoever happens
// to have a task/work item right now. Drives StaffSlicer everywhere and is
// the email-keyed join target for XPM staff once that's available.
export async function fetchKarbonUsers(): Promise<KarbonUser[]> {
  const rows = await fetchAllUsers();
  return rows
    .map((u) => {
      const name =
        pickStr(u, ["Name", "FullName", "DisplayName"]) ||
        [pickStr(u, ["FirstName"]), pickStr(u, ["LastName"])].filter(Boolean).join(" ");
      return {
        id: pickStr(u, ["UserKey", "Key", "Id"]),
        name,
        email: pickStr(u, ["EmailAddress", "Email"]),
      } satisfies KarbonUser;
    })
    .filter((u) => u.id);
}

export async function getKarbonUsers(
  excludedStaffIds: string[] = [],
  options: { forceRefresh?: boolean } = {},
): Promise<KarbonUser[]> {
  if (!options.forceRefresh) {
    const hit = await cacheGet<KarbonUser[]>(USERS_KEY);
    if (hit) return hit.filter((u) => !excludedStaffIds.includes(u.id));
  }
  const fresh = await fetchKarbonUsers();
  await cacheSet(USERS_KEY, fresh, USERS_TTL);
  return fresh.filter((u) => !excludedStaffIds.includes(u.id));
}

export interface KarbonUsersSnapshot {
  mode: "live" | "mock";
  users: KarbonUser[];
  syncedAt: string;
  message?: string;
}

// Shared by the /bas, /tasks, and /settings Server Components, which all
// need the same canonical roster for their StaffSlicer / staff toggle list.
export async function loadKarbonUsersSnapshot(
  excludedStaffIds: string[],
  mockUsers: KarbonUser[],
): Promise<KarbonUsersSnapshot> {
  if (!isKarbonConfigured()) {
    return {
      mode: "mock",
      users: mockUsers.filter((u) => !excludedStaffIds.includes(u.id)),
      syncedAt: new Date().toISOString(),
      message: "Showing mock data because KARBON_API_KEY is not set.",
    };
  }
  try {
    const users = await getKarbonUsers(excludedStaffIds);
    return { mode: "live", users, syncedAt: new Date().toISOString() };
  } catch (err) {
    if (err instanceof KarbonNotConfiguredError) {
      return {
        mode: "mock",
        users: mockUsers.filter((u) => !excludedStaffIds.includes(u.id)),
        syncedAt: new Date().toISOString(),
        message: err.message,
      };
    }
    return {
      mode: "live",
      users: [],
      syncedAt: new Date().toISOString(),
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
