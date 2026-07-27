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

// ─── Stale-while-revalidate ────────────────────────────────────────────
// A plain TTL cache makes every expiry somebody's problem: the unlucky user
// who arrives first after it lapses pays the full upstream cost (for XPM
// timesheets that's a job-list page-through plus one HTTP call per staff
// member) while staring at a blank page.
//
// These variants keep the value for a much longer *hard* TTL than the
// window it's considered fresh for. Past the fresh window the stale value
// is served immediately and a refresh runs after the response via Next's
// after(), so the cost lands on nobody. Only a genuinely absent value (cold
// cache, or older than the hard TTL) blocks.

interface StaleEnvelope<T> {
  v: T;
  freshUntil: number;
}

// Per-instance guard so concurrent requests on the same lambda don't each
// kick off their own background refresh of the same key.
const inFlight = new Set<string>();

function scheduleRefresh(key: string, refresh: () => Promise<void>): void {
  if (inFlight.has(key)) return;
  inFlight.add(key);

  const run = () =>
    refresh()
      .catch((err) => {
        console.error(`[cache] background refresh failed for "${key}":`, err);
      })
      .finally(() => {
        inFlight.delete(key);
      });

  // after() keeps the serverless invocation alive past the response so the
  // refresh actually completes. It throws outside a request scope (e.g. a
  // script or a test), where a detached promise is the best we can do.
  import("next/server")
    .then(({ after }) => {
      try {
        after(run);
      } catch {
        void run();
      }
    })
    .catch(() => {
      void run();
    });
}

function staleWhileRevalidate<T>(
  key: string,
  freshSeconds: number,
  loader: () => Promise<T>,
  read: (key: string) => Promise<StaleEnvelope<T> | null>,
  write: (key: string, envelope: StaleEnvelope<T>, ttl: number) => Promise<void>,
  hardTtlSeconds: number,
): Promise<T> {
  const store = async (value: T): Promise<void> => {
    await write(key, { v: value, freshUntil: Date.now() + freshSeconds * 1000 }, hardTtlSeconds);
  };

  return (async () => {
    const envelope = await read(key);

    if (envelope === null) {
      const fresh = await loader();
      await store(fresh);
      return fresh;
    }

    if (Date.now() < envelope.freshUntil) return envelope.v;

    scheduleRefresh(key, async () => {
      store(await loader());
    });
    return envelope.v;
  })();
}

// Default: keep serving a stale value for 12x the fresh window before a
// read is forced to block again.
const STALE_TTL_MULTIPLIER = 12;

export function cachedSWR<T>(
  key: string,
  freshSeconds: number,
  loader: () => Promise<T>,
  hardTtlSeconds = freshSeconds * STALE_TTL_MULTIPLIER,
): Promise<T> {
  return staleWhileRevalidate(
    key,
    freshSeconds,
    loader,
    (k) => cacheGet<StaleEnvelope<T>>(k),
    (k, envelope, ttl) => cacheSet(k, envelope, ttl),
    hardTtlSeconds,
  );
}

export function cachedEncryptedSWR<T>(
  key: string,
  freshSeconds: number,
  loader: () => Promise<T>,
  hardTtlSeconds = freshSeconds * STALE_TTL_MULTIPLIER,
): Promise<T> {
  return staleWhileRevalidate(
    key,
    freshSeconds,
    loader,
    (k) => cacheGetEncrypted<StaleEnvelope<T>>(k),
    (k, envelope, ttl) => cacheSetEncrypted(k, envelope, ttl),
    hardTtlSeconds,
  );
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
