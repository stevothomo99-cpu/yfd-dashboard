import { cacheGet, cacheSet, cacheGetEncrypted, cacheSetEncrypted } from "./cache";
import { fyYearFor } from "./utils";
import { encryptSecret, decryptSecret } from "./crypto";
import type { XpmStaff, XpmTimesheet, XpmInvoice, XpmServiceType } from "@/types/xpm";

const TOKEN_KEY = "xpm:access-token";
const REFRESH_KEY = "xpm:refresh-token";
const REFRESHED_AT_KEY = "xpm:refresh-rotated-at";
const STAFF_KEY = (partner: string) => `xpm:staff:${partner}`;
const TIMESHEETS_KEY = (partner: string) => `xpm:timesheets:${partner}`;
const INVOICES_KEY = (partner: string) => `xpm:invoices:${partner}`;

const STAFF_TTL = 24 * 60 * 60;
const TIMESHEETS_TTL = 15 * 60;
const INVOICES_TTL = 60 * 60;

const IDENTITY_URL = "https://identity.xero.com/connect/token";

// v3.0 always returns XML regardless of Accept header — only v3.1 supports
// JSON, which this client relies on throughout. Per Xero's v3.0→v3.1
// migration guide, the same OAuth scopes carry over; only the base URL
// changes.
function baseUrl(): string {
  return process.env.XPM_BASE_URL ?? "https://api.xero.com/practicemanager/3.1";
}

export class XpmNotConfiguredError extends Error {
  constructor() {
    super(
      "XPM env vars are not set (XPM_CLIENT_ID, XPM_CLIENT_SECRET, XPM_REFRESH_TOKEN, XPM_TENANT_ID).",
    );
    this.name = "XpmNotConfiguredError";
  }
}

export function isXpmConfigured(): boolean {
  return Boolean(
    process.env.XPM_CLIENT_ID &&
      process.env.XPM_CLIENT_SECRET &&
      process.env.XPM_REFRESH_TOKEN &&
      process.env.XPM_TENANT_ID,
  );
}

// Tokens are encrypted at rest (AES-256-GCM) before being written to the
// cache. A decrypt failure (e.g. XPM_TOKEN_ENCRYPTION_KEY was rotated, or a
// stale plaintext value from before encryption was added) is treated as a
// cache miss rather than a crash.
function tryDecrypt(value: string): string | null {
  try {
    return decryptSecret(value);
  } catch (err) {
    console.error("[xpm] Failed to decrypt cached token, treating as cache miss:", err);
    return null;
  }
}

async function currentRefreshToken(): Promise<string> {
  const stored = await cacheGet<string>(REFRESH_KEY);
  if (stored) {
    const decrypted = tryDecrypt(stored);
    if (decrypted) return decrypted;
  }

  // Xero rotates the refresh token on every successful exchange. If KV ever
  // held a rotated token and is now empty, the env-var token has been
  // invalidated and the next refresh attempt will fail. Surface this loudly
  // so an operator notices in Vercel logs before the user does.
  const lastRotatedAt = await cacheGet<string>(REFRESHED_AT_KEY);
  if (lastRotatedAt) {
    console.error(
      `[xpm] WARNING: stored refresh token missing but a rotation was recorded at ${lastRotatedAt}. ` +
        `Falling back to XPM_REFRESH_TOKEN env var, which Xero has almost certainly invalidated. ` +
        `Re-do Xero OAuth consent and update XPM_REFRESH_TOKEN before next sync.`,
    );
  }
  return process.env.XPM_REFRESH_TOKEN as string;
}

export interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// ─── One-time OAuth bootstrap ───────────────────────────────────────────
//
// Everything above assumes a refresh token already exists (XPM_REFRESH_TOKEN
// or a cached rotation of it). These three are only used by
// app/api/xpm/callback/route.ts, the once-ever consent callback that
// produces that first refresh token and the tenant ID -- deliberately not
// gated by isXpmConfigured(), since at this point XPM_REFRESH_TOKEN and
// XPM_TENANT_ID don't exist yet.

export interface XeroConnection {
  tenantId: string;
  tenantName: string;
}

export async function exchangeXeroAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<XeroTokenResponse> {
  if (!process.env.XPM_CLIENT_ID || !process.env.XPM_CLIENT_SECRET) {
    throw new Error("XPM_CLIENT_ID and XPM_CLIENT_SECRET must be set before completing Xero's OAuth consent.");
  }
  const credentials = Buffer.from(
    `${process.env.XPM_CLIENT_ID}:${process.env.XPM_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await fetch(IDENTITY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Xero token exchange failed: ${res.status} ${body}`);
  }
  return (await res.json()) as XeroTokenResponse;
}

export async function fetchXeroConnections(accessToken: string): Promise<XeroConnection[]> {
  const res = await fetch("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fetching Xero connections failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { tenantId: string; tenantName: string }[];
  return data.map((c) => ({ tenantId: c.tenantId, tenantName: c.tenantName }));
}

// Caches the freshly-exchanged tokens the same way refreshAccessToken()
// does, so the app can start working immediately once XPM_TENANT_ID is set
// -- XPM_REFRESH_TOKEN as an env var only ever matters as a cold-start
// fallback if the cache is later flushed.
export async function storeInitialXeroTokens(tokens: XeroTokenResponse): Promise<void> {
  await cacheSet(REFRESH_KEY, encryptSecret(tokens.refresh_token));
  await cacheSet(REFRESHED_AT_KEY, new Date().toISOString());
  const accessTtl = Math.max(tokens.expires_in - 5 * 60, 60);
  await cacheSet(TOKEN_KEY, encryptSecret(tokens.access_token), accessTtl);
}

async function refreshAccessToken(): Promise<string> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();

  const refreshToken = await currentRefreshToken();
  const credentials = Buffer.from(
    `${process.env.XPM_CLIENT_ID}:${process.env.XPM_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await fetch(IDENTITY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Xero token refresh failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as XeroTokenResponse;

  await cacheSet(REFRESH_KEY, encryptSecret(data.refresh_token));
  await cacheSet(REFRESHED_AT_KEY, new Date().toISOString());
  const accessTtl = Math.max(data.expires_in - 5 * 60, 60);
  await cacheSet(TOKEN_KEY, encryptSecret(data.access_token), accessTtl);
  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  const hit = await cacheGet<string>(TOKEN_KEY);
  if (hit) {
    const decrypted = tryDecrypt(hit);
    if (decrypted) return decrypted;
  }
  return refreshAccessToken();
}

export async function xpmFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();
  const url = baseUrl() + path;

  const buildHeaders = (token: string) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Xero-Tenant-Id", process.env.XPM_TENANT_ID as string);
    headers.set("Accept", "application/json");
    return headers;
  };

  let token = await getAccessToken();
  let res = await fetch(url, { ...init, headers: buildHeaders(token) });

  if (res.status === 401) {
    token = await refreshAccessToken();
    res = await fetch(url, { ...init, headers: buildHeaders(token) });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`XPM ${path} failed: ${res.status} ${body}`);
  }
  return (await res.json()) as T;
}

interface XpmJob {
  Partner?: { UUID: string; Name: string };
  Manager?: { UUID: string; Name: string };
  Client?: { UUID: string; Name: string };
}

interface XpmJobListResponse {
  Response?: {
    Jobs?: { Job?: XpmJob | XpmJob[] };
  };
}

interface XpmStaffDetailResponse {
  Response?: {
    Staff?: { UUID: string; Name: string; Email?: string };
  };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

// /job.api/list requires both `from` and `to` params (yyyyMMdd) --
// undocumented until tested against a live tenant, which 400s one
// requirement at a time. Set as wide as realistically possible so this
// only bounds how far back/forward job *creation* dates are considered,
// never excluding a genuinely in-progress job.
const JOB_LIST_FROM_DATE = "20000101";
const JOB_LIST_TO_DATE = "20991231";

// In-progress jobs owned by the given Partner. Shared by staff and client
// derivation so both only need one job.api/list call.
async function fetchXpmJobsForPartner(partnerName: string): Promise<XpmJob[]> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();
  if (!partnerName) return [];

  const jobs = await xpmFetch<XpmJobListResponse>(
    `/job.api/list?status=InProgress&from=${JOB_LIST_FROM_DATE}&to=${JOB_LIST_TO_DATE}`,
  );
  const jobsArr = asArray(jobs.Response?.Jobs?.Job);
  return jobsArr.filter((job) => job.Partner?.Name === partnerName);
}

export interface XpmClientRef {
  id: string;
  name: string;
}

function uniqueClientsFromJobs(jobs: XpmJob[]): XpmClientRef[] {
  const seen = new Map<string, XpmClientRef>();
  for (const job of jobs) {
    if (job.Client?.UUID && !seen.has(job.Client.UUID)) {
      seen.set(job.Client.UUID, { id: job.Client.UUID, name: job.Client.Name ?? "" });
    }
  }
  return Array.from(seen.values());
}

export async function fetchXpmClientsForPartner(partnerName: string): Promise<XpmClientRef[]> {
  const jobs = await fetchXpmJobsForPartner(partnerName);
  return uniqueClientsFromJobs(jobs);
}

export async function fetchXpmStaffForPartner(partnerName: string): Promise<XpmStaff[]> {
  const jobsArr = await fetchXpmJobsForPartner(partnerName);

  const managerIds = new Set<string>();
  for (const job of jobsArr) {
    if (job.Manager?.UUID) managerIds.add(job.Manager.UUID);
  }

  const details = await Promise.all(
    Array.from(managerIds).map((id) =>
      xpmFetch<XpmStaffDetailResponse>(`/staff.api/get/${id}`).catch(() => null),
    ),
  );

  return details
    .map((d) => d?.Response?.Staff)
    .filter((s): s is { UUID: string; Name: string; Email?: string } => Boolean(s))
    .map((s) => ({
      id: s.UUID,
      name: s.Name,
      email: s.Email ?? "",
      role: "Manager" as const,
      included: true,
    }));
}

export async function getXpmStaff(
  partnerName: string,
  options: { forceRefresh?: boolean } = {},
): Promise<XpmStaff[]> {
  const key = STAFF_KEY(partnerName);
  if (!options.forceRefresh) {
    const hit = await cacheGetEncrypted<XpmStaff[]>(key);
    if (hit) return hit;
  }
  const fresh = await fetchXpmStaffForPartner(partnerName);
  await cacheSetEncrypted(key, fresh, STAFF_TTL);
  return fresh;
}

// ─── Timesheets & invoices ──────────────────────────────────────────────
//
// The exact v3.1 JSON field names for the Time and Invoice resources are
// not confirmed against a live tenant (Xero's docs site blocks automated
// fetches, and 3.1-specific examples weren't otherwise available). The
// helpers below resolve several plausible candidate keys/wrapper shapes
// per field so a naming mismatch degrades to an empty/zero value instead
// of throwing — but the actual numbers should be spot-checked against
// Vercel logs once XPM_CLIENT_ID etc. are configured, the same way the
// Karbon WorkType label needed a real-tenant correction.

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

// Resolves a reference field that may appear either as a bare ID string or
// as a nested { UUID, Name } object, matching the shape already confirmed
// for Job.Partner / Job.Manager / Job.Client.
function pickRefId(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
    const ref = asRecord(v);
    if (typeof ref.UUID === "string") return ref.UUID;
  }
  return "";
}

function pickRefName(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const ref = asRecord(obj[k]);
    if (typeof ref.Name === "string") return ref.Name;
  }
  return "";
}

function pickNum(obj: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function pickDate(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length >= 10) return v.slice(0, 10);
  }
  return "";
}

function extractListRows(
  response: Record<string, unknown>,
  wrapperKeys: string[],
  itemKeys: string[],
): Record<string, unknown>[] {
  const top = asRecord(response.Response);
  for (const wrapperKey of wrapperKeys) {
    const wrapper = asRecord(top[wrapperKey]);
    for (const itemKey of itemKeys) {
      if (wrapper[itemKey] !== undefined) {
        return asArray(wrapper[itemKey]) as Record<string, unknown>[];
      }
    }
  }
  return [];
}

// A single Time entry may split its minutes across billable/non-billable —
// emit one XpmTimesheet row per non-zero portion.
function timeEntryRows(row: Record<string, unknown>, staffId: string): XpmTimesheet[] {
  const date = pickDate(row, ["Date", "StartTime"]);
  const clientId = pickRefId(row, ["Client"]);
  const jobId = pickRefId(row, ["Job"]);

  const billableMinutes = pickNum(row, ["BillableMinutes"]);
  const nonBillableMinutes = pickNum(row, ["NonBillableMinutes"]);

  if (billableMinutes > 0 || nonBillableMinutes > 0) {
    const rows: XpmTimesheet[] = [];
    if (billableMinutes > 0) {
      rows.push({ staffId, date, hours: billableMinutes / 60, billable: true, clientId, jobId });
    }
    if (nonBillableMinutes > 0) {
      rows.push({ staffId, date, hours: nonBillableMinutes / 60, billable: false, clientId, jobId });
    }
    return rows;
  }

  const minutes = pickNum(row, ["Minutes", "Duration"]);
  const billable = typeof row.Billable === "boolean" ? row.Billable : true;
  return [{ staffId, date, hours: minutes / 60, billable, clientId, jobId }];
}

async function fetchXpmTimeForStaff(staffId: string): Promise<XpmTimesheet[]> {
  const res = await xpmFetch<Record<string, unknown>>(`/time.api/staff/${staffId}`);
  const rows = extractListRows(res, ["Time", "TimeEntries", "Times"], ["Item", "TimeEntry", "Time"]);
  return rows.flatMap((row) => timeEntryRows(row, staffId));
}

export async function fetchXpmTimesheets(staff: { id: string }[]): Promise<XpmTimesheet[]> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();
  const perStaff = await Promise.all(
    staff.map((s) => fetchXpmTimeForStaff(s.id).catch(() => [] as XpmTimesheet[])),
  );
  return perStaff.flat();
}

export async function getXpmTimesheets(
  partnerName: string,
  options: { forceRefresh?: boolean } = {},
): Promise<XpmTimesheet[]> {
  const key = TIMESHEETS_KEY(partnerName);
  if (!options.forceRefresh) {
    const hit = await cacheGetEncrypted<XpmTimesheet[]>(key);
    if (hit) return hit;
  }
  const staff = await getXpmStaff(partnerName, options);
  const fresh = await fetchXpmTimesheets(staff);
  await cacheSetEncrypted(key, fresh, TIMESHEETS_TTL);
  return fresh;
}

// Service-type categorisation (Bookkeeping/Tax/Payroll/BAS/Advisory) isn't
// derivable from any confirmed Invoice field — it most likely lives on the
// underlying Job's category, not the invoice itself. Defaults to
// "Bookkeeping" until a real tenant response reveals the right field;
// revenue-by-service-type breakdowns won't be accurate until then.
const DEFAULT_SERVICE_TYPE: XpmServiceType = "Bookkeeping";

export async function fetchXpmInvoices(partnerName: string): Promise<XpmInvoice[]> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();

  const clients = await fetchXpmClientsForPartner(partnerName);
  const clientNames = new Map(clients.map((c) => [c.id, c.name]));
  const clientIds = new Set(clients.map((c) => c.id));

  const res = await xpmFetch<Record<string, unknown>>("/invoice.api/list");
  const rows = extractListRows(res, ["Invoices", "InvoiceList"], ["Invoice", "Item"]);
  const currentFy = fyYearFor(new Date());

  return rows
    .map((row) => {
      const clientId = pickRefId(row, ["Client"]);
      const date = pickDate(row, ["Date"]);
      return {
        id: pickStr(row, ["UUID", "ID"]),
        clientId,
        clientName: clientNames.get(clientId) ?? pickRefName(row, ["Client"]),
        amount: pickNum(row, ["AmountIncludingTax", "Amount"]),
        date,
        serviceType: DEFAULT_SERVICE_TYPE,
        fyYear: date ? fyYearFor(new Date(date + "T00:00:00Z")) : currentFy,
      } satisfies XpmInvoice;
    })
    .filter((inv) => clientIds.has(inv.clientId))
    // Bound the unscoped /invoice.api/list result to recent FYs only — the
    // same "full tenant history" risk that the Karbon WorkItems fetch had
    // before it got a date filter.
    .filter((inv) => inv.fyYear >= currentFy - 1);
}

export async function getXpmInvoices(
  partnerName: string,
  options: { forceRefresh?: boolean } = {},
): Promise<XpmInvoice[]> {
  const key = INVOICES_KEY(partnerName);
  if (!options.forceRefresh) {
    const hit = await cacheGetEncrypted<XpmInvoice[]>(key);
    if (hit) return hit;
  }
  const fresh = await fetchXpmInvoices(partnerName);
  await cacheSetEncrypted(key, fresh, INVOICES_TTL);
  return fresh;
}

