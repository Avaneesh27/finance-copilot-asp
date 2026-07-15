import { LRUCache } from 'lru-cache';

const TTL_MS = parseInt(process.env.CACHE_TTL_MS ?? '60000', 10);

// Wrap values in an object so lru-cache's `{}` constraint is satisfied,
// even when the cached value itself is null or an array.
interface Wrapped<T> { v: T }

/** Singleton LRU cache shared across all services. */
export const lruCache = new LRUCache<string, Wrapped<unknown>>({
  max: 500,
  ttl: TTL_MS,
  allowStale: false,
});

/**
 * Wraps an async fetcher with LRU caching.
 * Returns the cached value if fresh, otherwise calls fetcher, caches, and returns.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = lruCache.get(key);
  if (cached !== undefined) {
    return cached.v as T;
  }
  const fresh = await fetcher();
  lruCache.set(key, { v: fresh });
  return fresh;
}
