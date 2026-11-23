import { timingSafeEqual } from "node:crypto";

const enc = new TextEncoder();

function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Verifies that an incoming request traversed the Cloudflare Worker edge proxy.
 * Supports zero-downtime 90-day secret rotation via ORIGIN_VERIFY_SECRET_PREVIOUS.
 * Fails closed in production if ORIGIN_VERIFY_SECRET is unset.
 */
export function isFromEdge(headerValue: string | null): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const current = process.env.ORIGIN_VERIFY_SECRET?.trim();
  const previous = process.env.ORIGIN_VERIFY_SECRET_PREVIOUS?.trim();
  if (!current) return false;
  if (!headerValue) return false;
  const incoming = headerValue.trim();
  return safeEqual(incoming, current) || (Boolean(previous) && safeEqual(incoming, previous!));
}
