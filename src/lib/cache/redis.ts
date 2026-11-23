import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Upstash Redis cache for public/non-personal rate cards and settings only
 * (`rm_rates`, `sq_settings`, homepage featured rates).
 *
 * SECURITY RULE: Never cache user sessions, KYC data, or signed GCS/Supabase URLs.
 * All operations wrap in try/catch so exceeding the 500K/mo free tier cap or
 * transient network issues gracefully fall back to Supabase without breaking quoting.
 */

export const CACHE_KEYS = {
  GRADE_RATES: "mechonehub:rm_grade_rates:v1",
  SQ_SETTINGS: "mechonehub:sq_settings:v1",
  FEATURED_ITEMS: "mechonehub:rm_featured:v1",
} as const;

let redisInstance: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (redisInstance !== undefined) return redisInstance;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisInstance = null;
    return null;
  }
  try {
    redisInstance = new Redis({ url, token });
    return redisInstance;
  } catch {
    redisInstance = null;
    return null;
  }
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const redis = getRedis();
  if (redis) {
    try {
      const hit = await redis.get<T>(key);
      if (hit !== null && hit !== undefined) {
        return hit;
      }
    } catch {
      // Fall through to loader on Redis error or quota limit
    }
  }

  const fresh = await loader();

  if (redis && fresh !== null && fresh !== undefined) {
    try {
      await redis.set(key, fresh, { ex: ttlSeconds });
    } catch {
      // Ignore cache write errors
    }
  }

  return fresh;
}

export async function invalidateCache(...keys: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // Ignore cache invalidation errors
  }
}
