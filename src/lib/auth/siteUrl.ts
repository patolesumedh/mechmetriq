import "server-only";
import { headers } from "next/headers";

/**
 * Absolute origin of this deployment, for links in auth emails. Prefers
 * NEXT_PUBLIC_SITE_URL; falls back to the request's host so Vercel preview
 * deployments send links back to themselves.
 *
 * Every `${origin}/auth/callback` must be listed under Supabase → Auth →
 * URL Configuration → Redirect URLs, or Supabase falls back to the Site URL.
 */
export async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
