import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?91[-\s]?)?[6-9]\d{9}\b/g;
const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/gi;
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
const TOKEN_RE = /\b(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._~+/-]+=*)/g;
const SIGNED_URL_QUERY_RE = /([?&](?:X-Goog-Signature|X-Goog-Credential|token|token_hash|code)=)[^&\s]+/gi;

export function scrubPiiString(input: string): string {
  return input
    .replace(SIGNED_URL_QUERY_RE, "$1[REDACTED]")
    .replace(TOKEN_RE, "[REDACTED_TOKEN]")
    .replace(GSTIN_RE, "[REDACTED_GSTIN]")
    .replace(PAN_RE, "[REDACTED_PAN]")
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(PHONE_RE, "[REDACTED_PHONE]");
}

function scrubValue(val: unknown, depth = 0): unknown {
  if (depth > 6 || val === null || val === undefined) return val;
  if (typeof val === "string") return scrubPiiString(val);
  if (Array.isArray(val)) return val.map((item) => scrubValue(item, depth + 1));
  if (typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (/password|secret|token|cookie|authorization|kyc|gstin|pan|account_number|ifsc/i.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = scrubValue(v, depth + 1);
      }
    }
    return out;
  }
  return val;
}

export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  void _hint;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
      delete event.request.headers["x-origin-verify"];
      delete event.request.headers["x-cad-signature"];
      delete event.request.headers["x-razorpay-signature"];
    }
    if (event.request.url) event.request.url = scrubPiiString(event.request.url);
    if (event.request.query_string && typeof event.request.query_string === "string") {
      event.request.query_string = scrubPiiString(event.request.query_string);
    }
  }
  if (event.user) {
    event.user = { id: event.user.id };
  }
  if (event.message) {
    event.message = scrubPiiString(event.message);
  }
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubPiiString(ex.value);
    }
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: b.message ? scrubPiiString(b.message) : b.message,
      data: b.data ? (scrubValue(b.data) as Record<string, unknown>) : b.data,
    }));
  }
  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>;
  }
  return event;
}
