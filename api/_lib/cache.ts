import { Redis } from '@upstash/redis';

/** Stats older than 7 days are essentially final */
export const SEVEN_DAYS = 7 * 24 * 60 * 60;
/** Cache old data for 30 days */
export const STALE_TTL = 60 * 60 * 24 * 30;
/** Cache recent data for 15 minutes */
export const FRESH_TTL = 60 * 15;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redis;
}

/**
 * Get cached value or compute + store it.
 * @param key  Redis key
 * @param ttl  TTL in seconds (or function that receives the value and returns TTL)
 * @param fn   Async function to compute the value on cache miss
 */
export async function cached<T>(
  key: string,
  ttl: number | ((value: T) => number),
  fn: () => Promise<T>,
): Promise<T> {
  const r = getRedis();
  if (r) {
    try {
      const hit = await r.get(key);
      if (hit !== null && hit !== undefined) {
        return (typeof hit === 'string' ? JSON.parse(hit) : hit) as T;
      }
    } catch {
      // Redis down — fall through to compute
    }
  }

  const value = await fn();

  if (r && value !== null && value !== undefined) {
    try {
      const resolvedTtl = typeof ttl === 'function' ? ttl(value) : ttl;
      await r.set(key, JSON.stringify(value), { ex: resolvedTtl });
    } catch {
      // Redis down — ignore, we have the value
    }
  }

  return value;
}

/** Bust all cache keys matching a prefix */
export async function bustCache(prefix: string): Promise<number> {
  const r = getRedis();
  if (!r) return 0;

  let deleted = 0;
  let cursor = 0;
  do {
    const [nextCursor, keys] = await r.scan(cursor, { match: `${prefix}*`, count: 100 });
    cursor = nextCursor;
    if (keys.length > 0) {
      const pipeline = r.pipeline();
      for (const k of keys) pipeline.del(k);
      await pipeline.exec();
      deleted += keys.length;
    }
  } while (cursor !== 0);

  return deleted;
}
