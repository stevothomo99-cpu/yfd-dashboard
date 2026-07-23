import { cacheGet, cacheSet, cached } from "./cache";
import { encryptSecret, decryptSecret } from "./crypto";

// Core Xero Accounting API client -- a completely separate product/API
// from Xero Practice Manager (lib/xpm.ts), and connects to a DIFFERENT
// Xero organisation: specifically, whichever org is YFD's own accounting
// file where invoices are issued to clients. Deliberately not sharing any
// runtime state with lib/xpm.ts (separate cache keys, separate env vars)
// even though the OAuth mechanics and token-caching approach are
// identical, since this is a distinct connection consented separately.

const TOKEN_KEY = "xeroacct:access-token";
const REFRESH_KEY = "xeroacct:refresh-token";
const REFRESHED_AT_KEY = "xeroacct:refresh-rotated-at";

const IDENTITY_URL = "https://identity.xero.com/connect/token";
const API_BASE_URL = "https://api.xero.com/api.xro/2.0";

export class XeroAccountingNotConfiguredError extends Error {
  constructor() {
    super(
      "Xero Accounting env vars are not set (XERO_ACCOUNTING_CLIENT_ID, XERO_ACCOUNTING_CLIENT_SECRET, XERO_ACCOUNTING_REFRESH_TOKEN, XERO_ACCOUNTING_TENANT_ID).",
    );
    this.name = "XeroAccountingNotConfiguredError";
  }
}

export function isXeroAccountingConfigured(): boolean {
  return Boolean(
    process.env.XERO_ACCOUNTING_CLIENT_ID &&
      process.env.XERO_ACCOUNTING_CLIENT_SECRET &&
      process.env.XERO_ACCOUNTING_REFRESH_TOKEN &&
      process.env.XERO_ACCOUNTING_TENANT_ID,
  );
}

// Tokens are encrypted at rest the same way lib/xpm.ts does, reusing the
// same XPM_TOKEN_ENCRYPTION_KEY -- it's a general app-level secret-at-rest
// key, not something specific to Practice Manager, so there's no reason to
// require the admin to generate and set a second one.
function tryDecrypt(value: string): string | null {
  try {
    return decryptSecret(value);
  } catch (err) {
    console.error("[xeroAccounting] Failed to decrypt cached token, treating as cache miss:", err);
    return null;
  }
}

async function currentRefreshToken(): Promise<string> {
  const stored = await cacheGet<string>(REFRESH_KEY);
  if (stored) {
    const decrypted = tryDecrypt(stored);
    if (decrypted) return decrypted;
  }

  const lastRotatedAt = await cacheGet<string>(REFRESHED_AT_KEY);
  if (lastRotatedAt) {
    console.error(
      `[xeroAccounting] WARNING: stored refresh token missing but a rotation was recorded at ${lastRotatedAt}. ` +
        `Falling back to XERO_ACCOUNTING_REFRESH_TOKEN env var, which Xero has almost certainly invalidated. ` +
        `Re-do Xero OAuth consent and update XERO_ACCOUNTING_REFRESH_TOKEN before next fetch.`,
    );
  }
  return process.env.XERO_ACCOUNTING_REFRESH_TOKEN as string;
}

export interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// ─── One-time OAuth bootstrap ───────────────────────────────────────────
//
// Mirrors lib/xpm.ts's bootstrap trio exactly -- only used by
// app/api/xero-accounting/callback/route.ts, the once-ever consent
// callback that produces the first refresh token and tenant ID.

export interface XeroConnection {
  tenantId: string;
  tenantName: string;
}

export async function exchangeXeroAccountingAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<XeroTokenResponse> {
  if (!process.env.XERO_ACCOUNTING_CLIENT_ID || !process.env.XERO_ACCOUNTING_CLIENT_SECRET) {
    throw new Error(
      "XERO_ACCOUNTING_CLIENT_ID and XERO_ACCOUNTING_CLIENT_SECRET must be set before completing Xero's OAuth consent.",
    );
  }
  const credentials = Buffer.from(
    `${process.env.XERO_ACCOUNTING_CLIENT_ID}:${process.env.XERO_ACCOUNTING_CLIENT_SECRET}`,
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

export async function fetchXeroAccountingConnections(accessToken: string): Promise<XeroConnection[]> {
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

export async function storeInitialXeroAccountingTokens(tokens: XeroTokenResponse): Promise<void> {
  await cacheSet(REFRESH_KEY, encryptSecret(tokens.refresh_token));
  await cacheSet(REFRESHED_AT_KEY, new Date().toISOString());
  const accessTtl = Math.max(tokens.expires_in - 5 * 60, 60);
  await cacheSet(TOKEN_KEY, encryptSecret(tokens.access_token), accessTtl);
}

async function refreshAccessToken(): Promise<string> {
  if (!isXeroAccountingConfigured()) throw new XeroAccountingNotConfiguredError();

  const refreshToken = await currentRefreshToken();
  const credentials = Buffer.from(
    `${process.env.XERO_ACCOUNTING_CLIENT_ID}:${process.env.XERO_ACCOUNTING_CLIENT_SECRET}`,
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

export async function xeroAccountingFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isXeroAccountingConfigured()) throw new XeroAccountingNotConfiguredError();
  return xeroAccountingFetchForTenant<T>(process.env.XERO_ACCOUNTING_TENANT_ID as string, path, init);
}

// Same as xeroAccountingFetch, but for an explicit tenant id rather than
// whatever XERO_ACCOUNTING_TENANT_ID currently is -- lets
// /api/xero-accounting/diagnose check other candidate tenants from the same
// Xero login (e.g. an account with several orgs) without having to change
// env vars and redeploy just to compare them.
export async function xeroAccountingFetchForTenant<T>(
  tenantId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = API_BASE_URL + path;

  const buildHeaders = (token: string) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Xero-Tenant-Id", tenantId);
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
    throw new Error(`Xero Accounting ${path} failed: ${res.status} ${body}`);
  }
  return (await res.json()) as T;
}

// The Accounting API's default JSON serialisation renders dates as
// "/Date(1735689600000+0000)/" (a legacy .NET JSON convention), not ISO
// strings -- a well-documented Xero quirk, distinct from anything XPM did.
// Falls back to treating the value as already-ISO if the pattern doesn't
// match, so this degrades gracefully if that assumption turns out wrong
// once tested against a live tenant.
export function parseXeroDate(value: string): string {
  const match = value.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
  if (match) {
    return new Date(Number(match[1])).toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

interface XeroInvoiceContact {
  Name?: string;
}

interface XeroInvoiceRow {
  InvoiceID?: string;
  Contact?: XeroInvoiceContact;
  Date?: string;
  Status?: string;
  SubTotal?: number;
}

interface XeroInvoiceListResponse {
  Invoices?: XeroInvoiceRow[];
}

export interface XeroRevenueByClient {
  clientName: string;
  revenue: number;
}

// Xero rejects a `where` filter combined with summaryOnly=true (confirmed
// live: "The supplied filter is unavailable on this endpoint when using the
// summaryOnly flag"), so full invoice bodies are fetched instead -- heavier
// per page, but the only way to keep server-side date/status filtering.
// Paged at Xero's default 100-per-page until a page comes back empty; the
// cap is just a runaway-loop backstop, not an expected ceiling for a single
// week/month/quarter/FY window.
const INVOICE_FETCH_PAGE_CAP = 20;

async function fetchAllInvoicesInRange(fromIso: string, toIso: string): Promise<XeroInvoiceRow[]> {
  const [fromY, fromM, fromD] = fromIso.split("-").map(Number);
  const [toY, toM, toD] = toIso.split("-").map(Number);
  const where =
    `Type=="ACCREC"&&(Status=="AUTHORISED"||Status=="PAID")` +
    `&&Date>=DateTime(${fromY},${fromM},${fromD})&&Date<=DateTime(${toY},${toM},${toD})`;

  const all: XeroInvoiceRow[] = [];
  for (let page = 1; page <= INVOICE_FETCH_PAGE_CAP; page++) {
    const res = await xeroAccountingFetch<XeroInvoiceListResponse>(
      `/Invoices?where=${encodeURIComponent(where)}&page=${page}`,
    );
    const rows = res.Invoices ?? [];
    if (rows.length === 0) break;
    all.push(...rows);
  }
  return all;
}

// Revenue is counted as invoice SubTotal (ex-GST) on ACCREC (sales)
// invoices in AUTHORISED or PAID status within the date range -- DRAFT/
// VOIDED/DELETED invoices aren't real revenue. Matched to XPM clients by
// exact contact name (confirmed decision -- there's no stored link
// between an XPM client and a Xero Accounting contact).
export async function fetchRevenueByClientName(
  fromIso: string,
  toIso: string,
): Promise<XeroRevenueByClient[]> {
  if (!isXeroAccountingConfigured()) throw new XeroAccountingNotConfiguredError();

  const rows = await fetchAllInvoicesInRange(fromIso, toIso);

  const totals = new Map<string, number>();
  for (const inv of rows) {
    const name = inv.Contact?.Name;
    if (!name) continue;
    totals.set(name, (totals.get(name) ?? 0) + (inv.SubTotal ?? 0));
  }

  return Array.from(totals.entries()).map(([clientName, revenue]) => ({ clientName, revenue }));
}

const REVENUE_BY_CLIENT_TTL = 15 * 60;

// Cached wrapper around fetchRevenueByClientName -- the Clients page fetches
// this for all four period buttons (week/month/quarter/FY) on every page
// load to feed the slicer without a client-side round trip, so it's worth
// caching per date-range the same way lib/xpm.ts caches timesheets/invoices.
export async function getRevenueByClientName(fromIso: string, toIso: string): Promise<XeroRevenueByClient[]> {
  return cached(`xeroacct:revenue:${fromIso}:${toIso}`, REVENUE_BY_CLIENT_TTL, () =>
    fetchRevenueByClientName(fromIso, toIso),
  );
}

// Same revenue definition as fetchRevenueByClientName (ACCREC, AUTHORISED/
// PAID, SubTotal ex-GST) but a single practice-wide total rather than a
// per-client breakdown -- feeds the /personal "YFD — Sales" KPI tile, which
// only ever wants Month/YTD totals, not a client list.
export async function fetchTotalRevenue(fromIso: string, toIso: string): Promise<number> {
  if (!isXeroAccountingConfigured()) throw new XeroAccountingNotConfiguredError();

  const rows = await fetchAllInvoicesInRange(fromIso, toIso);
  return rows.reduce((sum, inv) => sum + (inv.SubTotal ?? 0), 0);
}
