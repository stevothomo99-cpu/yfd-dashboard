import { cacheGet, cacheSet } from "./cache";
import type { KarbonTask, KarbonTaskStatus, KarbonWorkItem, KarbonWorkStatus } from "@/types/karbon";

const TASKS_KEY = "karbon:tasks";
const WORK_KEY = "karbon:work";
const TASKS_TTL = 5 * 60;
const WORK_TTL = 10 * 60;

function baseUrl(): string {
  return process.env.KARBON_BASE_URL ?? "https://app.karbon.com/api/v1";
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

export async function karbonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isKarbonConfigured()) throw new KarbonNotConfiguredError();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${process.env.KARBON_API_KEY}`);
  headers.set("Accept", "application/json");
  // Karbon's v3 API also expects an AccessKey header. Set if provided so the
  // same client works against both v1 and v3 without code changes.
  if (process.env.KARBON_ACCESS_KEY) {
    headers.set("AccessKey", process.env.KARBON_ACCESS_KEY);
  }
  const res = await fetch(baseUrl() + path, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Karbon ${path} failed: ${res.status} ${body}`);
  }
  return (await res.json()) as T;
}

function unwrapList<T>(data: unknown, path: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "value" in data) {
    const v = (data as { value: unknown }).value;
    if (Array.isArray(v)) return v as T[];
  }
  throw new Error(`Karbon ${path}: expected array or { value: [...] }, got ${typeof data}`);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, 10);
}

function mapTaskStatus(raw: unknown): KarbonTaskStatus {
  if (typeof raw !== "string") return "todo";
  const norm = raw.toLowerCase();
  if (norm.includes("complete") || norm === "done" || norm === "closed") return "complete";
  if (norm.includes("progress") || norm === "doing") return "inProgress";
  return "todo";
}

function mapWorkStatus(raw: unknown): KarbonWorkStatus {
  if (typeof raw !== "string") return "notStarted";
  const norm = raw.toLowerCase();
  if (norm.includes("complete") || norm === "closed") return "complete";
  if (norm.includes("progress") || norm === "active") return "inProgress";
  return "notStarted";
}

function pickStr(obj: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return fallback;
}

export async function fetchKarbonTasks(): Promise<KarbonTask[]> {
  const data = await karbonFetch<unknown>("/Tasks");
  const rows = unwrapList<Record<string, unknown>>(data, "/Tasks");
  const today = todayIsoDate();

  return rows.map((t) => {
    const id = pickStr(t, ["Id", "TaskId", "Key"]);
    const status = mapTaskStatus(t.Status ?? t.StatusKey);
    const dueDate = dateOnly(t.DueDate);
    return {
      id,
      title: pickStr(t, ["Title", "Name", "Description"]),
      assigneeId: pickStr(t, ["AssigneeId", "AssigneeKey", "AssignedToId"]),
      assigneeName: pickStr(t, ["AssigneeName", "AssignedTo"]),
      clientId: pickStr(t, ["ClientId", "ClientKey", "WorkItemId"]),
      clientName: pickStr(t, ["ClientName", "Client", "WorkItemName"]),
      category: pickStr(t, ["Category", "WorkType", "WorkItemTypeName"]),
      dueDate,
      status,
      isOverdue: dueDate !== "" && dueDate < today && status !== "complete",
    } satisfies KarbonTask;
  });
}

export async function fetchKarbonWorkItems(): Promise<KarbonWorkItem[]> {
  const data = await karbonFetch<unknown>("/Work");
  const rows = unwrapList<Record<string, unknown>>(data, "/Work");

  return rows.map((w) => ({
    id: pickStr(w, ["Id", "WorkItemId", "Key"]),
    clientId: pickStr(w, ["ClientId", "ClientKey"]),
    clientName: pickStr(w, ["ClientName", "Client"]),
    type: pickStr(w, ["WorkItemTypeName", "WorkType", "Type"]),
    status: mapWorkStatus(w.Status ?? w.StatusKey),
    dueDate: dateOnly(w.DueDate),
    assigneeId: pickStr(w, ["AssigneeId", "AssigneeKey", "AssignedToId"]),
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
