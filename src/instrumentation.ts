export async function register() {
  // Skip runtime secret validation during `next build` static generation
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  // Staging guard: staging can never run live payments
  if (
    process.env.PAYMENTS_MODE === "live" &&
    process.env.NEXT_PUBLIC_SITE_URL !== "https://mechonehub.com"
  ) {
    throw new Error(
      "[startup] Fatal: PAYMENTS_MODE=live is strictly forbidden when NEXT_PUBLIC_SITE_URL is not https://mechonehub.com."
    );
  }

  // Production secret guard: fail fast if origin lock or KYC encryption key is missing
  if (process.env.NODE_ENV === "production") {
    if (!process.env.ORIGIN_VERIFY_SECRET) {
      throw new Error("[startup] Fatal: ORIGIN_VERIFY_SECRET is required in production.");
    }
    if (!process.env.KYC_ENCRYPTION_KEY) {
      throw new Error("[startup] Fatal: KYC_ENCRYPTION_KEY is required in production.");
    }
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/observability/sentry.server");
  }
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(err, request, context);
  }
}
