import type { NextConfig } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://mechonehub.com";
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

let host = "mechonehub.com";
try {
  host = new URL(SITE).host;
} catch {
  host = "mechonehub.com";
}

const supabaseWs = SUPABASE ? SUPABASE.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://") : "";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${SUPABASE} https://storage.googleapis.com`.replace(/\s+/g, " ").trim(),
  `connect-src 'self' ${SUPABASE} ${supabaseWs} https://storage.googleapis.com https://*.ingest.sentry.io https://api.razorpay.com`
    .replace(/\s+/g, " ")
    .trim(),
  "frame-src https://challenges.cloudflare.com https://api.razorpay.com https://checkout.razorpay.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")',
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: [host],
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
