// In-memory cache with 24h TTL. Resets on server restart.

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
  store.delete(key); // reset position
  store.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

export function makeCacheKey(params: Record<string, unknown>): string {
  return JSON.stringify(params);
}

// Prune expired entries periodically (every hour)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expiry) store.delete(key);
    }
  }, 60 * 60 * 1000);
}
