import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight health check for Cloud Run no-traffic revision probes and
 * BetterStack uptime monitoring. Zero DB queries, zero version/build metadata.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
