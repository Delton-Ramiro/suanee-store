import { Redis } from "ioredis";

if (!process.env["REDIS_URL"]) {
  throw new Error("REDIS_URL environment variable is required");
}

export const redis = new Redis(process.env["REDIS_URL"], {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("error", (err: Error) => {
  console.error("Redis error:", err);
});

// ─── Cache Helpers ────────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length > 0) await redis.del(...keys);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  // BUG-15: Use SCAN instead of KEYS to avoid blocking Redis on large datasets.
  const allKeys: string[] = [];
  let cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = parseInt(nextCursor, 10);
    allKeys.push(...keys);
  } while (cursor !== 0);
  if (allKeys.length > 0) await redis.del(...allKeys);
}

// ─── Cache Key Factories ─────────────────────────────────────────────────────

export const CacheKeys = {
  categoryTree: () => "categories:tree",
  categoryBySlug: (slug: string) => `categories:slug:${slug}`,
  storyList: () => "stories:list",
  mostSearched: () => "most-searched:list",
  product: (slug: string) => `products:${slug}`,
  searchResults: (query: string) => `search:${query}`,
};
