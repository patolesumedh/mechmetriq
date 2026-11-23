import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/cache/redis";

/**
 * Sliding-window rate limiters backed by Upstash Redis.
 *
 * Client IP is read from `X-Forwarded-For` which is set by our Cloudflare Worker
 * from `CF-Connecting-IP` after stripping any client-supplied forwarding headers,
 * and is trustworthy because `src/proxy.ts` enforces `isFromEdge()` first.
 *
 * All limiters fail open if Upstash is unconfigured or unreachable so transient
 * cache issues or hitting the 500K/mo free command cap never break production flows.
 */

function hashKey(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

export async function getTrustedClientIp(): Promise<string> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const cfIp = h.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();
  } catch {
    // Fallback outside request context
  }
  return "127.0.0.1";
}

let limiters: {
  authIpMin: Ratelimit;
  authIpHour: Ratelimit;
  authEmailHour: Ratelimit;
  uploadUserHour: Ratelimit;
  uploadIpHour: Ratelimit;
  previewPriceIpMin: Ratelimit;
} | null = null;

function getLimiters() {
  if (limiters) return limiters;
  const redis = getRedis();
  if (!redis) return null;

  limiters = {
    authIpMin: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      prefix: "rl:auth:ip:m",
    }),
    authIpHour: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 h"),
      prefix: "rl:auth:ip:h",
    }),
    authEmailHour: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 h"),
      prefix: "rl:auth:email:h",
    }),
    uploadUserHour: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 h"),
      prefix: "rl:upload:user:h",
    }),
    uploadIpHour: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 h"),
      prefix: "rl:upload:ip:h",
    }),
    previewPriceIpMin: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "rl:price:ip:m",
    }),
  };
  return limiters;
}

/**
 * Auth rate limits: 5/min & 20/hr per IP + 10/hr per email (or user identifier).
 */
export async function checkAuthRateLimit(identifier?: string): Promise<{ allowed: boolean; error?: string }> {
  const l = getLimiters();
  if (!l) return { allowed: true };

  try {
    const ip = await getTrustedClientIp();
    const [ipMin, ipHr] = await Promise.all([l.authIpMin.limit(ip), l.authIpHour.limit(ip)]);
    if (!ipMin.success || !ipHr.success) {
      return {
        allowed: false,
        error: "Too many attempts. Please wait a few minutes and try again.",
      };
    }
    if (identifier) {
      const emailRes = await l.authEmailHour.limit(hashKey(identifier));
      if (!emailRes.success) {
        return {
          allowed: false,
          error: "Too many attempts for this account. Please wait a few minutes and try again.",
        };
      }
    }
  } catch {
    // Fail open on Redis errors
  }
  return { allowed: true };
}

/**
 * Upload signed-URL rate limits: 30/hr per user + 60/hr per IP.
 */
export async function checkUploadRateLimit(userId: string): Promise<{ allowed: boolean; error?: string }> {
  const l = getLimiters();
  if (!l) return { allowed: true };

  try {
    const ip = await getTrustedClientIp();
    const [uRes, ipRes] = await Promise.all([
      l.uploadUserHour.limit(userId),
      l.uploadIpHour.limit(ip),
    ]);
    if (!uRes.success || !ipRes.success) {
      return {
        allowed: false,
        error: "Upload limit reached (max 30 files/hour). Please try again shortly.",
      };
    }
  } catch {
    // Fail open on Redis errors
  }
  return { allowed: true };
}

/**
 * Price preview endpoint rate limit: 60/min per IP.
 */
export async function checkPreviewPriceRateLimit(): Promise<{ allowed: boolean }> {
  const l = getLimiters();
  if (!l) return { allowed: true };

  try {
    const ip = await getTrustedClientIp();
    const res = await l.previewPriceIpMin.limit(ip);
    return { allowed: res.success };
  } catch {
    return { allowed: true };
  }
}

/**
 * Extracts the Turnstile CAPTCHA token from FormData.
 * Optional in local development when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset.
 */
export function getTurnstileToken(formData: FormData): string | undefined {
  const raw = formData.get("cf-turnstile-response");
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return undefined;
}
