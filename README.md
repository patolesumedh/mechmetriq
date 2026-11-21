# MECHmetrIQ (MechOneHub)

Mechanical Intelligence. Smarter Quotations.

A two-engine manufacturing platform deployed at **[mechonehub.com](https://mechonehub.com)** (`mechonehub.in` 301-redirects to `mechonehub.com`):
1. **Custom Manufacturing Quote-to-Order:** Buyer uploads a CAD part (`.step` / `.stp` / drawings) → instant geometry analysis & server-side pricing → RFQ / vendor assignment → order → production → delivery.
2. **Raw Materials Marketplace:** Buyer browses and purchases metals, plastics, and sheets by weight/cut-to-size from verified Raw Material Supplier vendors.

Fabrication and Raw Material vendors have separate onboarding, encrypted KYC workflows, and portals.

## Production Stack (Blueprint v3.1.0 — Mumbai Data Residency)

- **Edge & Domains:** GoDaddy registrar (`mechonehub.com`, `mechonehub.in`) delegated to **Cloudflare Free** (DNS, WAF Managed Rules, Rate Limiting, Turnstile CAPTCHA, Cloudflare Worker reverse proxy with `X-Origin-Verify` origin lock, and Cloudflare Access protecting `staging.mechonehub.com`).
- **Web App (`mechonehub-web`):** **Next.js 16** (App Router, `output: "standalone"`, Node.js `src/proxy.ts`), **React 19**, **TypeScript**, **Tailwind CSS v4**, running on **GCP Cloud Run (`asia-south1` Mumbai)**.
- **Isolated CAD Worker (`mechonehub-cad-worker`):** **Python 3.11 + FastAPI + CadQuery (OpenCascade)** on **GCP Cloud Run (`asia-south1` Mumbai)** with **zero database credentials**. Triggered via authenticated **GCP Pub/Sub Push** (`cad-analysis-jobs`), reads CAD uploads from private **GCS** (`gs://mechonehub-<env>-cad-files`), writes thumbnails under `derived/`, and reports results via HMAC-SHA256 callback to `/api/internal/cad-result`.
- **Database, Auth, Storage & Cache (`ap-south-1` Mumbai):**
  - **Supabase Free** (`mechonehub-staging`, `mechonehub-prod`) — PostgreSQL 17 + Row-Level Security (RLS) + Supabase Auth (Email OTP + Admin TOTP MFA `aal2`) + Supabase Storage for RLS-protected Vendor KYC documents (`DocUpload.tsx`).
  - **Upstash Redis Free** (`ap-south-1`) — caches non-personal rate cards (`rm_rates`, `sq_settings`) and powers sliding-window rate limiting on auth, signed upload URLs, and `/api/preview-price`.
  - **Resend Free** — Custom SMTP (`no-reply@mechonehub.com`) with SPF/DKIM/DMARC.
  - **Observability & Backups:** Sentry Free (with PII scrubbing), BetterStack uptime checks (`/api/health`), 48-hour anon-key keep-alive (`supabase-keepalive.yml`), and nightly `age`-encrypted PostgreSQL 17 backups to GCS (`supabase-backup.yml`).

## Project Structure

```text
src/
  instrumentation.ts          Startup fail-fast guard (blocks PAYMENTS_MODE=live outside prod) & Sentry init
  proxy.ts                    Next 16 proxy: constant-time X-Origin-Verify lock + Supabase session refresh + idle timeout
  app/
    page.tsx                  Public marketing homepage
    login/, register/, ...    Turnstile-protected + rate-limited auth flows & TOTP MFA
    buyer/                    Buyer portal: instant quote builder, RFQs, orders, marketplace, checkout
    vendor/fabrication/       Machining/Fabrication vendor portal & KYC onboarding
    vendor/raw_material/      Raw Material Supplier vendor portal & KYC onboarding
    admin/                    Admin portal: users, vendor KYC review, catalog, Smart Quote rates
    api/
      health/route.ts         Zero-DB health check for Cloud Run revision probes & BetterStack
      preview-price/route.ts  Server-only pricing preview (zod-validated, rate-limited)
      internal/cad-result/    HMAC-SHA256 verified callback from mechonehub-cad-worker
      webhooks/razorpay/      Constant-time signature-verified, idempotent Razorpay webhook handler
  lib/
    security/                 originVerify.ts (constant-time origin lock) & rateLimit.ts (Upstash sliding window)
    storage/gcs.ts            Keyless V4 GCS signed URLs (15-min PUT, 10-min GET, 50 MB cap, ownership checks)
    cache/redis.ts            Upstash Redis cache helper with safe fallback
    smartQuote/               Server-only pricing engine (`pricing.ts`), client formatters (`pricingFormat.ts`), Pub/Sub dispatch
services/smartquote/          Isolated Python 3.11 + CadQuery STEP parser (`/pubsub/analyze` & `/analyze`)
cloudflare-worker/            Cloudflare Worker reverse proxy (`wrangler.toml` for prod + staging)
infra/                        Per-env GCS CORS (`cors.prod.json`, `cors.staging.json`), lifecycles, Artifact Registry policy
scripts/provision-gcp.sh      Idempotent GCP provisioning script (`ENV=staging|prod`)
supabase/                     `config.toml`, sequential migrations (`0001`–`0025`), and `seed.sql`
docs/DEPLOYMENT_RUNBOOK.md    Step-by-step manual portal deployment guide
```

## Local Development

1. Install Node.js 22+ dependencies:
   ```bash
   npm ci
   ```
2. Copy `.env.example` to `.env.local` and fill in your local/staging Supabase URL and anon key:
   ```bash
   cp .env.example .env.local
   ```
3. Run quality checks and start the dev server:
   ```bash
   npm run lint
   npm run typecheck
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Branching & Deployment

See **[`CONTRIBUTING.md`](CONTRIBUTING.md)** for the `feature/* → staging → main` workflow and **[`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md)** for the complete step-by-step cloud deployment runbook.

*(Note: `render.yaml` is retained temporarily during the Phase 5 cutover and retired once `mechonehub-cad-worker` is live on Cloud Run.)*
