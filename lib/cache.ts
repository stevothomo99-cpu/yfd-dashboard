import Redis from "ioredis";
import { encryptSecret, decryptSecret } from "./crypto";

const NAMESPACE = "yfd:";

function isConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

interface MemoryEntry {
  value: unknown;
  expiresAt: number | null;
}

// Dev-only fallback for when no real Redis is attached (e.g. REDIS_URL
// unset locally). Pinned to globalThis so it survives Turbopack/webpack
// re-instantiating this module across separate route/page bundles in the
// same process — without this, a PATCH via a route handler and a read from
// a page Server Component could each see their own independent Map and
// silently disagree.
const globalForCache = globalThis as unknown as {
  __yfdCacheMemory?: Map<string, MemoryEntry>;
  __yfdRedisClient?: Redis;
};
const memory = globalForCache.__yfdCacheMemory ?? new Map<string, MemoryEntry>();
globalForCache.__yfdCacheMemory = memory;

function client(): Redis {
  if (!globalForCache.__yfdRedisClient) {
    globalForCache.__yfdRedisClient = new Redis(process.env.REDIS_URL as string, {
      maxRetriesPerRequest: 3,
    });
  }
  return globalForCache.__yfdRedisClient;
}

function nsKey(key: string): string {
  return NAMESPACE + key;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const k = nsKey(key);
  if (!isConfigured()) {
    const entry = memory.get(k);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      memory.delete(k);
      return null;
    }
    return entry.value as T;
  }
  const raw = await client().get(k);
  return raw === null ? null : (JSON.parse(raw) as T);
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  const k = nsKey(key);
  if (!isConfigured()) {
    memory.set(k, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
    return;
  }
  const raw = JSON.stringify(value);
  if (ttlSeconds && ttlSeconds > 0) {
    await client().set(k, raw, "EX", ttlSeconds);
  } else {
    await client().set(k, raw);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const k = nsKey(key);
  if (!isConfigured()) {
    memory.delete(k);
    return;
  }
  await client().del(k);
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const fresh = await loader();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

export function isKvConfigured(): boolean {
  return isConfigured();
}

// Encrypted variants, for cached data containing sensitive business/PII
// information (e.g. XPM/Karbon staff, timesheets, invoices, tasks) rather
// than short-lived tokens. A decrypt failure (key rotation, or a stale
// unencrypted value from before this existed) is treated as a cache miss.
export async function cacheGetEncrypted<T>(key: string): Promise<T | null> {
  const raw = await cacheGet<string>(key);
  if (raw === null) return null;
  try {
    return JSON.parse(decryptSecret(raw)) as T;
  } catch (err) {
    console.error(
      `[cache] Failed to decrypt cached value for key "${key}", treating as cache miss:`,
      err,
    );
    return null;
  }
}

export async function cacheSetEncrypted<T>(
  key: string,
  value: T,
  ttlSeconds?: number,
): Promise<void> {
  await cacheSet(key, encryptSecret(JSON.stringify(value)), ttlSeconds);
}

export async function cachedEncrypted<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGetEncrypted<T>(key);
  if (hit !== null) return hit;
  const fresh = await loader();
  await cacheSetEncrypted(key, fresh, ttlSeconds);
  return fresh;
}
