import { cacheGet, cacheSet } from "./cache";
import type { XpmStaff } from "@/types/xpm";

const TOKEN_KEY = "xpm:access-token";
const REFRESH_KEY = "xpm:refresh-token";
const REFRESHED_AT_KEY = "xpm:refresh-rotated-at";
const STAFF_KEY = (partner: string) => `xpm:staff:${partner}`;

const STAFF_TTL = 24 * 60 * 60;

const IDENTITY_URL = "https://identity.xero.com/connect/token";

function baseUrl(): string {
  return process.env.XPM_BASE_URL ?? "https://api.xero.com/practicemanager/3.0";
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

async function currentRefreshToken(): Promise<string> {
  const stored = await cacheGet<string>(REFRESH_KEY);
  if (stored) return stored;

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

interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
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

  await cacheSet(REFRESH_KEY, data.refresh_token);
  await cacheSet(REFRESHED_AT_KEY, new Date().toISOString());
  const accessTtl = Math.max(data.expires_in - 5 * 60, 60);
  await cacheSet(TOKEN_KEY, data.access_token, accessTtl);
  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  const hit = await cacheGet<string>(TOKEN_KEY);
  if (hit) return hit;
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

export async function fetchXpmStaffForPartner(partnerName: string): Promise<XpmStaff[]> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();
  if (!partnerName) return [];

  const jobs = await xpmFetch<XpmJobListResponse>("/job.api/list?status=InProgress");
  const jobsArr = asArray(jobs.Response?.Jobs?.Job);

  const managerIds = new Set<string>();
  for (const job of jobsArr) {
    if (job.Partner?.Name === partnerName && job.Manager?.UUID) {
      managerIds.add(job.Manager.UUID);
    }
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
    const hit = await cacheGet<XpmStaff[]>(key);
    if (hit) return hit;
  }
  const fresh = await fetchXpmStaffForPartner(partnerName);
  await cacheSet(key, fresh, STAFF_TTL);
  return fresh;
}

