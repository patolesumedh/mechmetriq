import "server-only";
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./scrub";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const environment =
    process.env.SENTRY_ENVIRONMENT ||
    (siteUrl === "https://mechonehub.com"
      ? "production"
      : siteUrl.includes("staging.")
        ? "staging"
        : process.env.NODE_ENV || "development");

  Sentry.init({
    dsn,
    environment,
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: 0.1,
    beforeSend: scrubSentryEvent,
    ...({ sendDefaultPii: false } as Record<string, unknown>),
  });
}
