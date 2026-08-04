import {
  cacheGet,
  cacheSet,
  cacheGetEncrypted,
  cacheSetEncrypted,
  cachedEncryptedSWR,
} from "./cache";
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
// How long a stale timesheet payload may still be served while a refresh
// runs in the background. Beyond this a read blocks on XPM again.
const TIMESHEETS_STALE_TTL = 6 * 60 * 60;
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

const RATE_LIMIT_RETRIES = 4;
const RATE_LIMIT_BASE_DELAY_MS = 1000;

// Xero permits 5 concurrent requests per tenant. Anything fanning out
// per-staff or per-window must stay under that or the excess comes back 429.
const XPM_MAX_CONCURRENCY = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

// Promise.all with a ceiling on how many run at once. Results keep input
// order, and a rejection propagates as it would from Promise.all.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function xpmFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();
  const url = baseUrl() + path;

  const buildHeaders = (token: string) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Xero-Tenant-Id", process.env.XPM_TENANT_ID as string);
    headers.set("Accept", "application/json");
    // Practice Manager 3.1 doesn't actually honour Accept: application/json
    // for content negotiation without opting into this feature flag --
    // without it, every response comes back as XML regardless of Accept,
    // discovered by testing against a live tenant (undocumented in any
    // comment here before now).
    headers.set("Xero-Features", "practice-strict-content-type");
    return headers;
  };

  let token = await getAccessToken();
  let res = await fetch(url, { ...init, headers: buildHeaders(token) });

  if (res.status === 401) {
    token = await refreshAccessToken();
    res = await fetch(url, { ...init, headers: buildHeaders(token) });
  }

  // Xero rate-limits hard (429) and occasionally 5xxs. Without this, a
  // throttled call threw like any other failure -- and callers that catch
  // per-item to stay resilient (fetchXpmTimesheetsForPartner catches per
  // staff member) turned that into silently missing data rather than an
  // error anyone would see. Retry-After is honoured when Xero sends it.
  for (let attempt = 0; attempt < RATE_LIMIT_RETRIES && isRetryable(res.status); attempt += 1) {
    const retryAfter = Number(res.headers.get("Retry-After"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt;
    console.warn(
      `[xpm] ${path} got ${res.status}; retrying in ${waitMs}ms (attempt ${attempt + 1}/${RATE_LIMIT_RETRIES})`,
    );
    await sleep(waitMs);
    res = await fetch(url, { ...init, headers: buildHeaders(token) });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`XPM ${path} failed: ${res.status} ${body}`);
  }
  return (await res.json()) as T;
}

interface XpmJobParty {
  uuid: string;
  name: string;
}

// Real flat shape confirmed against a live tenant -- the previous
// Response.Jobs.Job nested-envelope guess never matched, so
// fetchXpmJobsForPartner silently returned [] always (jobs.Response was
// always undefined), which is why nothing ever actually synced before now.
interface XpmJob {
  id: string;
  uuid: string;
  name: string;
  client?: XpmJobParty;
  manager?: XpmJobParty;
  partner?: XpmJobParty;
  assigned?: XpmJobParty[];
  state?: string;
}

interface XpmJobListResponse {
  jobs?: XpmJob[];
  status?: string;
}

// Real flat shape confirmed against a live tenant, same story as jobs --
// {staffList: [...], status: "OK"}, not a Response.Staff envelope. This one
// call replaces the old per-manager staff.api/get/:id loop entirely.
export interface XpmStaffRecord {
  uuid: string;
  name: string;
  email: string;
}

interface XpmStaffListResponse {
  staffList?: XpmStaffRecord[];
  status?: string;
}

export async function fetchAllXpmStaffRecords(): Promise<XpmStaffRecord[]> {
  const res = await xpmFetch<XpmStaffListResponse>("/staff.api/list");
  return res.staffList ?? [];
}

// Clients carry their own Partner/Manager assignment directly -- confirmed
// against a live tenant's client detail page ("Partner: Steve Thomas,
// Manager: Joel Buenviaje"), where the API's field names turned out to be
// accountManager (Partner) and jobManager (Manager). This is the real
// Partner filter: it's an assignment on the client itself, not something
// that has to be inferred from whichever jobs happen to be in a date
// window. isArchived/isDeleted come back as "Yes"/"No" strings, not
// booleans, and archived+deleted clients ARE included in the list response
// by default (confirmed: a tenant with far fewer active clients still
// returned 225 total) -- so both must be filtered out client-side.
interface XpmClientRecord {
  uuid: string;
  name: string;
  isArchived?: string;
  isDeleted?: string;
  accountManager?: XpmJobParty;
  jobManager?: XpmJobParty;
}

interface XpmClientListResponse {
  clients?: XpmClientRecord[];
  status?: string;
}

async function fetchAllXpmClientRecords(): Promise<XpmClientRecord[]> {
  const res = await xpmFetch<XpmClientListResponse>("/client.api/list");
  return res.clients ?? [];
}

function isActiveXpmClient(c: XpmClientRecord): boolean {
  return c.isArchived !== "Yes" && c.isDeleted !== "Yes";
}

export interface XpmClientAllocation {
  id: string;
  name: string;
  accountManagerName: string | null;
  jobManagerName: string | null;
}

// One-off audit report, not scoped to any single Partner -- every active
// client in the tenant with its Account Manager (our "Partner") and Job
// Manager (our "Staff") as currently set in XPM, so gaps/mistakes can be
// found and fixed at the source rather than discovered one at a time when a
// client silently fails to sync (Account Manager isn't a required field at
// the client level in XPM, only at the job level, so it's easy for a client
// to end up with none set at all). See app/api/xpm/client-allocations.
export async function fetchXpmClientAllocationReport(): Promise<XpmClientAllocation[]> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();
  const clients = await fetchAllXpmClientRecords();
  return clients
    .filter(isActiveXpmClient)
    .map((c) => ({
      id: c.uuid,
      name: c.name,
      accountManagerName: c.accountManager?.name ?? null,
      jobManagerName: c.jobManager?.name ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface XpmClientDirectoryEntry {
  name: string;
  // Null means no Account Manager is set on the client in XPM, which is
  // exactly the condition that keeps it out of our own customers sync (see
  // fetchActiveXpmClientsForPartner) -- surfaced so the UI can say "we know
  // who this is, it just isn't allocated to you" rather than "unknown".
  accountManagerName: string | null;
}

const CLIENT_DIRECTORY_KEY = "xpm:client-directory";
const CLIENT_DIRECTORY_TTL = 60 * 60;

// Every active client in the tenant, keyed by XPM client id -- a name
// lookup of last resort for ids that appear in timesheets but never made it
// into our synced customers table. Deliberately not Partner-filtered: the
// whole point is to name clients the Partner filter excluded.
//
// The client roster has no date-window dependency (unlike jobs/invoices),
// so this is a single call, cached and served stale-while-revalidate since
// client names change rarely and this sits on a page render path.
export async function getXpmClientDirectory(): Promise<Record<string, XpmClientDirectoryEntry>> {
  return cachedEncryptedSWR(CLIENT_DIRECTORY_KEY, CLIENT_DIRECTORY_TTL, async () => {
    const clients = await fetchXpmClientAllocationReport();
    const byId: Record<string, XpmClientDirectoryEntry> = {};
    for (const c of clients) {
      byId[c.id] = { name: c.name, accountManagerName: c.accountManagerName };
    }
    return byId;
  });
}

export interface XpmPartnerOption {
  name: string;
  clientCount: number;
}

// The valid values for the Partner filter in Settings: every distinct
// accountManager across active XPM clients, with how many clients each one
// holds.
//
// Sourced from accountManager rather than the XPM staff roster because that
// is precisely the field the Partner filter is compared against (see
// fetchActiveXpmClientsForPartner), so every option here is guaranteed to
// select at least one client -- whereas an arbitrary staff name could match
// nothing and silently sync an empty practice. Reuses the cached client
// directory, so offering this list costs no extra XPM call.
export async function getXpmPartnerOptions(): Promise<XpmPartnerOption[]> {
  const directory = await getXpmClientDirectory();
  const counts = new Map<string, number>();
  for (const entry of Object.values(directory)) {
    if (!entry.accountManagerName) continue;
    counts.set(entry.accountManagerName, (counts.get(entry.accountManagerName) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, clientCount]) => ({ name, clientCount }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Active clients whose accountManager (Partner) matches the given name --
// shared by client/staff/job derivation so they all agree on exactly which
// clients are "ours" out of the whole tenant.
async function fetchActiveXpmClientsForPartner(partnerName: string): Promise<XpmClientRecord[]> {
  if (!partnerName) return [];
  const clients = await fetchAllXpmClientRecords();
  return clients.filter((c) => isActiveXpmClient(c) && c.accountManager?.name === partnerName);
}

function formatYyyyMmDd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// /job.api/list requires `from`/`to` params (yyyyMMdd) spanning less than
// a year -- both undocumented until tested against a live tenant (400s one
// requirement at a time: missing from, then missing to, then "date range
// ... less than one year"). Computed fresh on every call as a rolling
// 360-day window ending today, rather than hardcoded dates that would
// eventually go stale -- trades "might miss a job opened >1yr ago that's
// still in progress" for "always a valid range, no maintenance".
export function xpmJobListDateRange(): { from: string; to: string } {
  const now = new Date();
  const yearAgo = new Date(now);
  yearAgo.setUTCDate(yearAgo.getUTCDate() - 360);
  return { from: formatYyyyMmDd(yearAgo), to: formatYyyyMmDd(now) };
}

// A single from/to call only ever sees rows within that ~360-day window --
// confirmed against a live tenant for job.api/list (plenty of still-"In
// Progress" jobs, e.g. FY25 engagements, started well over a year ago and
// would be silently missed by one call) and the same span limit applies to
// invoice.api/list. Xero's per-call span limit forces us to page across
// multiple rolling windows and merge by id instead. Shared by both list
// endpoints below.
function rollingWindowBounds(windowsAgo: number): { from: string; to: string } {
  const to = new Date();
  to.setUTCDate(to.getUTCDate() - windowsAgo * 360);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 360);
  return { from: formatYyyyMmDd(from), to: formatYyyyMmDd(to) };
}

// 8 windows (~8 years) is generous headroom for a practice whose oldest
// still-open jobs seen so far go back to mid-2024.
const JOB_LIST_WINDOW_COUNT = 8;

async function fetchAllInProgressXpmJobs(): Promise<XpmJob[]> {
  const windows = Array.from({ length: JOB_LIST_WINDOW_COUNT }, (_, i) => rollingWindowBounds(i));
  const responses = await Promise.all(
    windows.map(({ from, to }) =>
      xpmFetch<XpmJobListResponse>(`/job.api/list?status=InProgress&from=${from}&to=${to}`),
    ),
  );

  const byUuid = new Map<string, XpmJob>();
  for (const res of responses) {
    for (const job of res.jobs ?? []) {
      if (!byUuid.has(job.uuid)) byUuid.set(job.uuid, job);
    }
  }
  return Array.from(byUuid.values());
}

export interface XpmClientRef {
  id: string;
  name: string;
}

export async function fetchXpmClientsForPartner(partnerName: string): Promise<XpmClientRef[]> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();
  const clients = await fetchActiveXpmClientsForPartner(partnerName);
  return clients.map((c) => ({ id: c.uuid, name: c.name }));
}

// Same client roster as above, but carrying each client's jobManager uuid
// too -- exported (not just used internally) so the staff/customers/jobs
// sync can assign a job to its client's manager when the job itself
// doesn't set one directly (several automated/ad-hoc jobs have no manager
// field at all).
export interface XpmClientWithManager {
  id: string;
  name: string;
  managerId: string | null;
}

export async function fetchXpmClientsWithManagerForPartner(
  partnerName: string,
): Promise<XpmClientWithManager[]> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();
  const clients = await fetchActiveXpmClientsForPartner(partnerName);
  return clients.map((c) => ({ id: c.uuid, name: c.name, managerId: c.jobManager?.uuid ?? null }));
}

// Whoever appears as a Partner-filtered client's `jobManager` -- this is
// our "Staff" role (not "Manager"; confirmed directly that XPM's own
// "Manager" label maps to what this dashboard calls Staff). Sourced from
// the client roster rather than a job list, so it isn't at the mercy of
// which date window a job happens to fall into.
export async function fetchXpmStaffForPartner(partnerName: string): Promise<XpmStaff[]> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();
  const clients = await fetchActiveXpmClientsForPartner(partnerName);

  const managerIds = new Set<string>();
  for (const c of clients) {
    if (c.jobManager?.uuid) managerIds.add(c.jobManager.uuid);
  }
  if (managerIds.size === 0) return [];

  const allStaff = await fetchAllXpmStaffRecords();
  return allStaff
    .filter((s) => managerIds.has(s.uuid))
    .map((s) => ({
      id: s.uuid,
      name: s.name,
      email: s.email,
      role: "Staff" as const,
      included: true,
    }));
}

// In-progress jobs belonging to a client in the Partner's roster -- clients
// are the source of truth for "is this ours" (see
// fetchActiveXpmClientsForPartner above); a job's own partner/manager
// fields are used only for populating job.manager_id, with the client's
// jobManager as a fallback for jobs that don't set one directly (several
// automated/ad-hoc jobs have no manager field at all). Exported so the
// staff/customers/jobs sync can pull the full job records too.
export async function fetchXpmJobsForPartner(partnerName: string): Promise<XpmJob[]> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();
  if (!partnerName) return [];

  const clients = await fetchActiveXpmClientsForPartner(partnerName);
  const clientIds = new Set(clients.map((c) => c.uuid));
  if (clientIds.size === 0) return [];

  const jobs = await fetchAllInProgressXpmJobs();
  return jobs.filter((job) => job.client?.uuid && clientIds.has(job.client.uuid));
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

// Xero's XML-derived JSON collapses a single-item list to a bare object
// instead of a one-element array -- still relied on by the time.api
// parsing below, which hasn't been re-confirmed against a live tenant yet.
function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
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

// Real flat shape confirmed against a live tenant: {times: [...], status:
// "OK"}, each entry {uuid, job: {id, name}, task: {uuid, name}, staff:
// {uuid, name}, date, minutes, billable, note, webUrl} -- no client field
// at all. Time entries reference a job by its short "id" (e.g. "Y100805"),
// not the uuid jobs are keyed by elsewhere in this file, so attributing an
// entry to a client goes through a job-id->client lookup built from the
// confirmed job list, not anything on the entry itself. task.name (e.g.
// "YFD - Leave" vs "YFD - Idle" vs "YFD - General Admin") is what
// distinguishes Leave from other internal, non-billable work within the
// single internal job -- confirmed via the XPM job's own task list.
export interface XpmTimeEntry {
  uuid: string;
  job?: { id: string; name: string };
  task?: { uuid: string; name: string };
  date: string;
  minutes: number;
  billable: boolean;
}

interface XpmTimeListResponse {
  times?: XpmTimeEntry[];
  status?: string;
}

async function fetchXpmTimeEntriesForStaff(
  staffId: string,
  from: string,
  to: string,
): Promise<XpmTimeEntry[]> {
  const res = await xpmFetch<XpmTimeListResponse>(`/time.api/staff/${staffId}?from=${from}&to=${to}`);
  return res.times ?? [];
}

// Every time entry logged by any staff member (not just Partner/Staff-role
// people we track) against a job under one of the Partner's clients --
// querying the whole tenant's staff roster, not just recognised managers,
// catches hours logged by anyone else assigned to those jobs too (there is
// no time.api-by-client endpoint, only time.api-by-staff).
export async function fetchXpmTimesheetsForPartner(
  partnerName: string,
  from: string,
  to: string,
): Promise<XpmTimesheet[]> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();

  const [jobs, allStaff] = await Promise.all([
    fetchXpmJobsForPartner(partnerName),
    fetchAllXpmStaffRecords(),
  ]);

  const clientByJobId = new Map<string, string>();
  for (const job of jobs) {
    if (job.client?.uuid) clientByJobId.set(job.id, job.client.uuid);
  }

  // Throttled rather than Promise.all over the whole tenant roster: that
  // fired one time.api call per staff member at once, well past Xero's
  // 5-concurrent limit, so the surplus 429'd and -- being caught per staff
  // member below -- silently reported those people as having logged zero
  // hours. Joshua Manzano's 153h vanishing this way is what found it.
  const perStaff = await mapWithConcurrency(
    allStaff,
    XPM_MAX_CONCURRENCY,
    async (s) => {
      // A failed call for one person must not fail the whole practice's
      // timesheet load -- but it used to be swallowed entirely, which made
      // "this person's time API errored" indistinguishable from "this
      // person logged nothing". Logged loudly now.
      const entries = await fetchXpmTimeEntriesForStaff(s.uuid, from, to).catch((err) => {
        console.error(
          `[xpm] time.api failed for staff ${s.name} (${s.uuid}) -- their hours will read as zero:`,
          err instanceof Error ? err.message : err,
        );
        return [] as XpmTimeEntry[];
      });
      const rows: XpmTimesheet[] = [];
      for (const e of entries) {
        const clientId = e.job?.id ? clientByJobId.get(e.job.id) : undefined;
        if (!clientId || !e.job) continue;
        rows.push({
          staffId: s.uuid,
          date: e.date.slice(0, 10),
          hours: e.minutes / 60,
          billable: e.billable,
          clientId,
          jobId: e.job.id,
          taskName: e.task?.name ?? null,
        });
      }
      return rows;
    },
  );

  return perStaff.flat();
}

// The most expensive upstream call in the app -- a job-list page-through
// plus one HTTP request per staff member (fetchXpmTimesheetsForPartner) --
// and it sits on the critical path of /dashboard, /clients and /timesheets.
// Served stale-while-revalidate so an expired cache costs a background
// refresh rather than making whoever loaded the page wait for all of it.
export interface XpmTimesheetDiagnosticRow {
  staffName: string;
  staffId: string;
  fetchFailed: boolean;
  rawEntries: number;
  keptEntries: number;
  keptHours: number;
  droppedEntries: number;
  droppedHours: number;
  // Jobs the entries were logged against that aren't in the Partner's job
  // list, so every entry against them was discarded.
  droppedJobs: { id: string; name: string; hours: number }[];
}

// Why a staff member reads as zero hours. Three quite different causes look
// identical on /timesheets -- they logged nothing, their time.api call
// failed, or everything they logged was against a job outside the Partner's
// job list (a client allocated elsewhere, unallocated, or archived) and got
// discarded by fetchXpmTimesheetsForPartner's filter.
//
// Deliberately uncached and not Partner-filtered on the staff side: it walks
// the same path as the real fetch and reports what that path threw away.
export async function diagnoseXpmTimesheetsForPartner(
  partnerName: string,
): Promise<XpmTimesheetDiagnosticRow[]> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();
  const { from, to } = xpmJobListDateRange();

  const [jobs, allStaff] = await Promise.all([
    fetchXpmJobsForPartner(partnerName),
    fetchAllXpmStaffRecords(),
  ]);

  const clientByJobId = new Map<string, string>();
  for (const job of jobs) {
    if (job.client?.uuid) clientByJobId.set(job.id, job.client.uuid);
  }

  // Same concurrency ceiling as the real fetch -- an unthrottled diagnostic
  // would trip the very rate limit it's meant to detect and report everyone
  // as failing.
  return mapWithConcurrency(allStaff, XPM_MAX_CONCURRENCY, async (s) => {
      let fetchFailed = false;
      const entries = await fetchXpmTimeEntriesForStaff(s.uuid, from, to).catch(() => {
        fetchFailed = true;
        return [] as XpmTimeEntry[];
      });

      let keptEntries = 0;
      let keptHours = 0;
      let droppedEntries = 0;
      let droppedHours = 0;
      const droppedByJob = new Map<string, { id: string; name: string; hours: number }>();

      for (const e of entries) {
        const hours = e.minutes / 60;
        const clientId = e.job?.id ? clientByJobId.get(e.job.id) : undefined;
        if (clientId && e.job) {
          keptEntries += 1;
          keptHours += hours;
          continue;
        }
        droppedEntries += 1;
        droppedHours += hours;
        const id = e.job?.id ?? "(no job on entry)";
        const existing = droppedByJob.get(id);
        if (existing) existing.hours += hours;
        else droppedByJob.set(id, { id, name: e.job?.name ?? "(no job on entry)", hours });
      }

      return {
        staffName: s.name,
        staffId: s.uuid,
        fetchFailed,
        rawEntries: entries.length,
        keptEntries,
        keptHours,
        droppedEntries,
        droppedHours,
        droppedJobs: Array.from(droppedByJob.values()).sort((a, b) => b.hours - a.hours),
      };
  });
}

export async function getXpmTimesheets(
  partnerName: string,
  options: { forceRefresh?: boolean } = {},
): Promise<XpmTimesheet[]> {
  const key = TIMESHEETS_KEY(partnerName);
  const load = async () => {
    const { from, to } = xpmJobListDateRange();
    return fetchXpmTimesheetsForPartner(partnerName, from, to);
  };

  // The manual "Resync" in Settings must actually hit XPM, not accept a
  // stale value -- so it bypasses the cache and reseeds it.
  if (options.forceRefresh) {
    const fresh = await load();
    await cacheSetEncrypted(key, { v: fresh, freshUntil: Date.now() + TIMESHEETS_TTL * 1000 }, TIMESHEETS_STALE_TTL);
    return fresh;
  }

  return cachedEncryptedSWR(key, TIMESHEETS_TTL, load, TIMESHEETS_STALE_TTL);
}

// Service-type categorisation (Bookkeeping/Tax/Payroll/BAS/Advisory) isn't
// derivable from any confirmed Invoice field — it most likely lives on the
// underlying Job's category, not the invoice itself. Defaults to
// "Bookkeeping" until a real tenant response reveals the right field;
// revenue-by-service-type breakdowns won't be accurate until then.
const DEFAULT_SERVICE_TYPE: XpmServiceType = "Bookkeeping";

// Same undocumented-until-tested span limit as job.api/list -- confirmed
// live that /invoice.api/list 400s without a `from` param at all (in the
// same yyyyMMdd format), so it's paged across rolling windows and merged by
// id the same way. Only 3 windows (~3 years) since invoices are filtered
// down to the current + previous FY below anyway -- one window of headroom
// in case a FY boundary doesn't land cleanly inside a single ~360-day span.
const INVOICE_LIST_WINDOW_COUNT = 3;

export async function fetchXpmInvoices(partnerName: string): Promise<XpmInvoice[]> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();

  const clients = await fetchXpmClientsForPartner(partnerName);
  const clientNames = new Map(clients.map((c) => [c.id, c.name]));
  const clientIds = new Set(clients.map((c) => c.id));

  const windows = Array.from({ length: INVOICE_LIST_WINDOW_COUNT }, (_, i) => rollingWindowBounds(i));
  const responses = await Promise.all(
    windows.map(({ from, to }) =>
      xpmFetch<Record<string, unknown>>(`/invoice.api/list?from=${from}&to=${to}`),
    ),
  );

  const rowsById = new Map<string, Record<string, unknown>>();
  for (const res of responses) {
    for (const row of extractListRows(res, ["Invoices", "InvoiceList"], ["Invoice", "Item"])) {
      const id = pickStr(row, ["UUID", "ID"]);
      if (!rowsById.has(id)) rowsById.set(id, row);
    }
  }

  const currentFy = fyYearFor(new Date());

  return Array.from(rowsById.values())
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
    // Bound the result to recent FYs only — the same "full tenant history"
    // risk that the Karbon WorkItems fetch had before it got a date filter.
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

