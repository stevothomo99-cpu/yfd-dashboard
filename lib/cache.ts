import { kv } from "@vercel/kv";

const NAMESPACE = "yfd:";

function isConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

interface MemoryEntry {
  value: unknown;
  expiresAt: number | null;
}

// Dev-only fallback for when no real KV store is attached. Pinned to
// globalThis so it survives Turbopack/webpack re-instantiating this module
// across separate route/page bundles in the same process — without this, a
// PATCH via a route handler and a read from a page Server Component could
// each see their own independent Map and silently disagree.
const globalForCache = globalThis as unknown as { __yfdCacheMemory?: Map<string, MemoryEntry> };
const memory = globalForCache.__yfdCacheMemory ?? new Map<string, MemoryEntry>();
globalForCache.__yfdCacheMemory = memory;

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
  return (await kv.get<T>(k)) ?? null;
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
  if (ttlSeconds && ttlSeconds > 0) {
    await kv.set(k, value, { ex: ttlSeconds });
  } else {
    await kv.set(k, value);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const k = nsKey(key);
  if (!isConfigured()) {
    memory.delete(k);
    return;
  }
  await kv.del(k);
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
