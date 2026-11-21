import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const environment =
    siteUrl === "https://mechonehub.com"
      ? "production"
      : siteUrl.includes("staging.")
        ? "staging"
        : process.env.NODE_ENV || "development";

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: 0.1,
    beforeSend: scrubSentryEvent,
    ...({ sendDefaultPii: false } as Record<string, unknown>),
  });
}
