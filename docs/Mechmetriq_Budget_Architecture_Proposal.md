---
title: "MECHmetrIQ — Budget-Optimized Production Architecture Proposal"
document_type: "Cost-Optimized Production Architecture Specification"
version: "2.1.0"
date: "2026-11-02"
author: "Lakshman Shrinivasan"
target_monthly_cost: "₹12,000–₹20,000/month ($150–$250)"
target_platform: "GCP Cloud Run + Supabase Pro + Cloudflare Free + Upstash Redis"
industrial_standards:
  - "DPDP Act 2023 (Digital Personal Data Protection Act, 2023)"
  - "GDPR (EU 2016/679)"
  - "FIPS 140-3 & FIPS 197 (AES-256)"
  - "RFC 8446 (TLS 1.3)"
  - "CIS GCP Foundations Benchmark"
status: "Execution Ready"
---

# MECHmetrIQ — Budget-Optimized Production Architecture

> **Companion to:** [Full Production Architecture Review](./Mechmetriq_Architecture_review.md)
> **Goal:** Production-grade security & scalability at **~₹12,000-20,000/month** (~$150-250)
> **Philosophy:** Pay only for what you use. Scale to zero when idle. Upgrade components as revenue grows.

---

## Table of Contents

1. [Cost Comparison at a Glance](#1-cost-comparison-at-a-glance)
2. [Architecture — The "Smart Cheap" Stack](#2-architecture--the-smart-cheap-stack)
3. [Component-by-Component Breakdown](#3-component-by-component-breakdown)
4. [Security — No Compromises, Lower Cost](#4-security--same-protection-lower-cost)
5. [Scaling Tiers — Grow With Revenue](#5-scaling-tiers--grow-with-revenue)
6. [What We Keep vs What We Change](#6-what-we-keep-vs-what-we-change)
7. [Migration Path — Minimal Code Changes](#7-migration-path--minimal-code-changes)
8. [Detailed Cost Breakdown](#8-detailed-cost-breakdown)
9. [Trade-offs — What You Give Up](#9-trade-offs--what-you-give-up)

---

## 1. Cost Comparison at a Glance

| | Current (Free Tiers) | Budget Plan | Premium Plan (AWS) |
|---|---|---|---|
| **Monthly Cost** | $0 | **~$150-250** | ~$1,210 |
| **Monthly Cost (₹)** | ₹0 | **~₹12,000-20,000** | ~₹1,00,000 |
| **Concurrent Users** | ~5 | **100-300** | 1000+ |
| **CAD Processing** | 1 worker, 60s cold start | **Auto-scaled, ~5s cold start** | Always-warm fleet |
| **Security** | Basic | **Production-grade** | Enterprise-grade |
| **Uptime SLA** | None | **99.5%** | 99.95% |
| **Multi-AZ/DR** | ❌ | ❌ (single region) | ✅ |
| **Best For** | Demo | **Early revenue (0-500 users)** | Scale (500+ users) |

---

## 2. Architecture — The "Smart Cheap" Stack

> **Core Principle:** Use **serverless / scale-to-zero** services everywhere. You pay nothing when no one is using the platform (nights, weekends). Costs scale linearly with actual usage.

```
┌──────────────────────────────────────────────────────────────────────┐
│                            USERS / BROWSERS                          │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE (FREE TIER)                           │
│                                                                      │
│  ✅ DDoS protection (Unmetered, always free)                        │
│  ✅ WAF basic rules (5 free custom rules)                           │
│  ✅ CDN for static assets (unlimited bandwidth)                     │
│  ✅ Bot protection (basic)                                          │
│  ✅ SSL/TLS termination                                             │
│  ✅ Rate limiting (1 free rule)                                     │
│  ✅ Analytics                                                       │
│                                                                      │
│  💰 Cost: $0/month                                                  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    GCP CLOUD RUN (Pay-per-request)                   │
│                                                                      │
│  ┌─────────────────────────────────────────────┐                    │
│  │  Service: mechmetriq-web                    │                    │
│  │                                              │                    │
│  │  Next.js 16 SSR (same codebase!)            │                    │
│  │  + Quote Service (pricing.ts — server only) │                    │
│  │  + Upload handler (presigned URL generation) │                    │
│  │                                              │                    │
│  │  Config:                                     │                    │
│  │  • Min instances: 0 (scale to zero!)         │                    │
│  │  • Max instances: 10                         │                    │
│  │  • CPU: 1 vCPU                               │                    │
│  │  • Memory: 512 MB                            │                    │
│  │  • Concurrency: 80 requests/instance         │                    │
│  │  • Cold start: ~2-3s (acceptable)            │                    │
│  │                                              │                    │
│  │  💰 Free tier: 2M requests/month FREE        │                    │
│  │     Then: ~$0.40 per million requests        │                    │
│  │     + $0.00002400/vCPU-second                │                    │
│  │     + $0.00000250/GiB-second                 │                    │
│  └─────────────────────────────────────────────┘                    │
│                                                                      │
│  ┌─────────────────────────────────────────────┐                    │
│  │  Service: mechmetriq-cad-worker             │                    │
│  │                                              │                    │
│  │  Python + CadQuery 2.8 (OpenCascade)        │                    │
│  │  Triggered by Pub/Sub (async!)              │                    │
│  │                                              │                    │
│  │  Config:                                     │                    │
│  │  • Min instances: 0 (scale to zero!)         │                    │
│  │  • Max instances: 20                         │                    │
│  │  • CPU: 2 vCPU                               │                    │
│  │  • Memory: 2 GB                              │                    │
│  │  • Timeout: 300s (for large STEP files)      │                    │
│  │  • Concurrency: 1 (CPU-heavy, 1 job/inst)   │                    │
│  │                                              │                    │
│  │  💰 Billed ONLY when processing a file       │                    │
│  │     ~$0.05 per CAD file analysis             │                    │
│  │     100 files/day = ~$150/month              │                    │
│  │     10 files/day = ~$15/month                │                    │
│  └─────────────────────────────────────────────┘                    │
│                                                                      │
│  💰 Cloud Run Total: ~$30-80/month (usage-dependent)                │
└──────────┬───────────────┬───────────────────────────────────────────┘
           │               │
           ▼               ▼
┌──────────────────┐   ┌──────────────────────────────────────────────┐
│  GCP Pub/Sub     │   │  GCP Cloud Storage (GCS)                    │
│                  │   │                                              │
│  Message queue   │   │  • STEP files + thumbnails                  │
│  for CAD jobs    │   │  • Default encryption (Google-managed keys)  │
│                  │   │  • Uniform bucket-level access (no public)   │
│  Dead letter     │   │  • Signed URLs (15 min expiry)              │
│  topic for       │   │  • Object lifecycle: 90-day auto-delete     │
│  failed jobs     │   │  • Access logging enabled                    │
│                  │   │                                              │
│  💰 ~$1/month    │   │  💰 ~$5-15/month (500GB)                    │
└──────────────────┘   └──────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                   │
│                                                                      │
│  ┌────────────────────────┐    ┌────────────────────────────┐       │
│  │  SUPABASE PRO ($25/mo) │    │  UPSTASH REDIS (Serverless)│       │
│  │                        │    │                            │       │
│  │  Why keep Supabase:    │    │  • Pay-per-command          │       │
│  │  • Existing code works │    │  • 10K commands/day FREE    │       │
│  │    with zero changes   │    │  • Rate card caching        │       │
│  │  • Auth (GoTrue) stays │    │  • Session caching          │       │
│  │  • RLS policies stay   │    │  • File hash dedup cache    │       │
│  │  • Realtime subscr.    │    │  • Rate limiting counters   │       │
│  │                        │    │                            │       │
│  │  Pro tier gives:       │    │  💰 Free → $10/month       │       │
│  │  • 8GB database        │    │     (depends on usage)      │       │
│  │  • 250GB bandwidth     │    │                            │       │
│  │  • 100GB file storage  │    │                            │       │
│  │  • 500K auth users     │    │                            │       │
│  │  • Daily backups       │    │                            │       │
│  │  • 7-day log retention │    │                            │       │
│  │                        │    │                            │       │
│  │  💰 $25/month          │    │                            │       │
│  └────────────────────────┘    └────────────────────────────┘       │
│                                                                      │
│  NOTE: Supabase Pro uses AWS under the hood (us-east-1 or           │
│  ap-southeast-1). For the Indian market, pick Singapore region.     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                     OBSERVABILITY (Budget)                            │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│  │ GCP Cloud     │  │ Sentry Free   │  │ BetterStack   │            │
│  │ Logging       │  │               │  │ Free Tier     │            │
│  │ (built-in)    │  │ 5K errors/mo  │  │               │            │
│  │               │  │ Frontend +    │  │ Uptime        │            │
│  │ 50 GB/mo free │  │ Backend error │  │ monitoring    │            │
│  │               │  │ tracking      │  │ 10 monitors   │            │
│  │ 💰 $0         │  │ 💰 $0         │  │ 💰 $0         │            │
│  └───────────────┘  └───────────────┘  └───────────────┘            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                     OTHER SERVICES                                    │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│  │ Resend        │  │ Razorpay      │  │ GitHub        │            │
│  │ (Email)       │  │ (Payments)    │  │ Actions       │            │
│  │               │  │               │  │ (CI/CD)       │            │
│  │ 3000 emails/  │  │ 2% per txn    │  │               │            │
│  │ month FREE    │  │ (no monthly)  │  │ 2000 min/mo   │            │
│  │               │  │               │  │ FREE          │            │
│  │ 💰 $0         │  │ 💰 $0 fixed   │  │ 💰 $0         │            │
│  └───────────────┘  └───────────────┘  └───────────────┘            │
└──────────────────────────────────────────────────────────────────────┘
```

### Why This Stack Works

| Design Choice | Rationale |
|--------------|-----------|
| **GCP Cloud Run (not ECS Fargate)** | Scale-to-zero = $0 when idle. Fargate charges even when idle. Cloud Run's generous free tier (2M req/month) covers early traffic for free. |
| **Keep Supabase (upgrade to Pro)** | Existing code works with ZERO changes to auth, RLS, or database queries. Saves 2 weeks of migration work. $25/mo for a managed Postgres is unbeatable. |
| **Cloudflare Free (not AWS WAF + CloudFront)** | AWS WAF = $30/mo + CloudFront = $85/mo. Cloudflare Free = $0/mo and gives you DDoS protection, CDN, basic WAF, and rate limiting for free. |
| **Upstash Redis (not ElastiCache)** | ElastiCache = $120/mo minimum (always running). Upstash = pay-per-command, free tier covers light usage. |
| **GCP Pub/Sub (not SQS)** | Both work well, but Pub/Sub integrates natively with Cloud Run push subscriptions — zero polling code needed. |
| **GCS (not separate S3)** | Stay in one cloud provider. Same security features (encryption, signed URLs, access logs). Slightly cheaper than S3 for storage. |
| **Monolith kept (not microservices)** | For <500 users, splitting into 4 services adds complexity without benefit. Keep the Next.js monolith but deploy it on Cloud Run instead of Vercel. |

---

## 3. Component-by-Component Breakdown

### 3.1 Web Application (Cloud Run)

```
CURRENT                              PROPOSED
───────                              ────────
Vercel (free tier)                   GCP Cloud Run
• Serverless functions               • Containerized Next.js
• 10s timeout (60s Pro)              • 300s timeout
• ~100 concurrent invocations        • 80 concurrent/instance × 10 = 800
• No control over infra              • Full Docker control
• $0/month                           • ~$20-50/month (pay-per-use)
```

**Key change:** The Next.js app stays as one codebase but is containerized in Docker. This removes Vercel's timeout limitations and gives full control over the runtime.

```dockerfile
# Dockerfile for the Next.js app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
```

### 3.2 CAD Analysis Worker (Cloud Run + Pub/Sub)

```
CURRENT                              PROPOSED
───────                              ────────
Render free tier                     GCP Cloud Run (Pub/Sub triggered)
• 1 worker                           • 0-20 auto-scaled workers
• 512 MB / 0.1 CPU                   • 2 GB / 2 vCPU each
• Sleeps after 15 min                • Scale to zero (no idle cost!)
• ~60s cold start                    • ~5s cold start (warm container pool)
• Static X-API-Key                   • IAM service account (no API keys)
• $0/month                           • ~$0.05 per file analyzed
```

**How it works:**

```
1. User uploads STEP file
2. Upload handler saves file to GCS
3. Publishes message to Pub/Sub topic: { file_path, analysis_id, user_id }
4. Cloud Run worker auto-spins up (if not already running)
5. Worker downloads file from GCS via signed URL
6. Runs CadQuery analysis → writes results to Supabase DB
7. Sends real-time notification via Supabase Realtime
8. Worker scales back to zero if no more messages
```

**Cost math:**
- Average STEP file analysis: ~30 seconds of 2 vCPU + 2 GB
- Cost per analysis: ~$0.05
- 10 files/day (early stage): **~$15/month**
- 50 files/day (growth): **~$75/month**
- 200 files/day (scale): **~$300/month**

### 3.3 Database (Supabase Pro)

```
CURRENT                              PROPOSED
───────                              ────────
Supabase Free                        Supabase Pro ($25/month)
• 500 MB database                    • 8 GB database
• 2 GB file storage                  • 100 GB file storage
• 50K auth users                     • 500K auth users
• 60 connections                     • 200+ connections (Supavisor pooling)
• No backups                         • Daily backups, 7-day PITR
• Shared compute                     • Dedicated compute option available
```

> [!TIP]
> **Why not migrate to RDS?** Supabase Pro gives you managed Postgres with connection pooling (Supavisor), Auth, Storage, and Realtime — all for $25/month. A comparable self-managed RDS setup would cost $350/month and require rewriting all auth, storage, and realtime code.

**What to change in code:** Almost nothing!
- Keep all `client.ts`, `server.ts`, `admin.ts` Supabase client variants
- Keep all RLS policies
- Keep `@supabase/ssr` for auth
- Add: Upstash Redis caching for `sq_settings` and `rm_rates`

### 3.4 File Storage Strategy

```
OPTION A: Keep Supabase Storage (simpler)
  • Already integrated in code
  • 100 GB included in Pro plan
  • Signed URLs work out of the box
  • ⚠️ No customer-managed encryption keys
  • ⚠️ Limited access logging

OPTION B: Move to GCS (more secure) ← RECOMMENDED
  • $5-15/month for 500 GB
  • Google-managed encryption (free) or CMEK ($1/key/month)
  • Signed URLs with 15-min expiry
  • Full Cloud Audit Logs
  • Object lifecycle policies
  • Bucket Lock for compliance
  • Code change: ~50 lines (upload/download handlers)
```

**Recommendation:** Use **GCS for CAD files** (security-critical) and **keep Supabase Storage for non-sensitive files** (KYC docs, profile images). This hybrid approach gives you strong security where it matters without rewriting everything.

### 3.5 Real-Time Notifications

```
CURRENT                              PROPOSED
───────                              ────────
None                                 Supabase Realtime (included in Pro!)

How it works:
• Worker writes analysis status to `cad_analyses` table
• Frontend subscribes to Supabase Realtime channel
• Status changes (PENDING → PROCESSING → DONE) push to browser instantly
• Zero additional cost — included in Supabase Pro
```

**Code example:**
```typescript
// Frontend: Subscribe to analysis updates
const channel = supabase
  .channel('cad-analysis')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'cad_analyses',
    filter: `buyer_id=eq.${userId}`
  }, (payload) => {
    // Update UI: "Your quote is ready!"
    setAnalysisStatus(payload.new.status);
  })
  .subscribe();
```

---

## 4. Security — Same Protection, Lower Cost

> [!IMPORTANT]
> Security is NOT where we cut corners. Every critical security measure from the premium plan is preserved here — just with cost-effective alternatives.

| Security Feature | Premium Plan | Budget Plan | Security Level |
|-----------------|-------------|-------------|----------------|
| **DDoS protection** | AWS Shield Advanced ($3K/mo) | Cloudflare Free (unmetered DDoS) | ✅ Same |
| **WAF** | AWS WAF ($30/mo) | Cloudflare Free (5 custom rules) | 🟡 Slightly less flexible |
| **CDN + TLS** | CloudFront ($85/mo) | Cloudflare Free | ✅ Same |
| **File encryption at rest** | S3 + KMS CMK ($10/mo) | GCS default encryption (Google-managed) | 🟡 Not customer-managed |
| **Signed URLs** | S3 presigned (15 min) | GCS signed URLs (15 min) | ✅ Same |
| **Auth + MFA** | AWS Cognito | Supabase Auth (GoTrue) + MFA | ✅ Same |
| **RLS (row-level security)** | Custom on RDS | Supabase RLS (already built) | ✅ Same |
| **Rate limiting** | ALB + WAF rules | Cloudflare rule + Upstash Redis | ✅ Same |
| **Audit logging** | CloudTrail ($) | GCS Access Logs + App-level logging | 🟡 Less integrated |
| **Secrets management** | AWS Secrets Manager ($5/mo) | GCP Secret Manager (6 free secrets) | ✅ Same |
| **Pricing algo protection** | Server-side only | Server-side only | ✅ Same |
| **Virus scanning** | ClamAV on Lambda | ClamAV in Cloud Run | ✅ Same |

### What We Still Do (Non-Negotiable Security)

```
✅ Pricing algorithm removed from browser bundle
✅ CAD files uploaded via signed URLs (never through app server)
✅ All files encrypted at rest
✅ Signed URLs expire in 15 minutes
✅ RLS enforced on every database table
✅ Auth with session cookies (httpOnly, secure, SameSite)
✅ Rate limiting per user per IP
✅ CORS + CSP headers configured
✅ All secrets in GCP Secret Manager (zero hardcoded)
✅ CAD file access audit logging
✅ NDA acceptance workflow before vendor access
✅ Automatic file deletion after 90 days
✅ Digital Personal Data Protection Act, 2023 (DPDP Act 2023) & GDPR compliance for PII data minimization
```

### What We Defer (Not Critical for Launch)

```
⏸️ Customer-managed encryption keys (CMEK) — upgrade when enterprise clients demand it
⏸️ Multi-AZ / disaster recovery — add when SLA commitments require it
⏸️ SOC 2 / ISO 27001 certification — pursue when closing enterprise deals
⏸️ Blockchain IP anchoring — add as a premium feature later
⏸️ Dynamic watermarking — add in Phase 2
```

---

## 5. Scaling Tiers — Grow With Revenue

> **Start small, scale components independently as usage grows.**

### Tier 1: Starter (~$150/month, ~₹12,500)
**For: 0-100 daily users, 10-20 CAD files/day**

| Component | Spec | Cost |
|-----------|------|------|
| Cloud Run (Web) | 0-3 instances, 1 vCPU, 512 MB | ~$20 |
| Cloud Run (CAD Worker) | 0-5 instances, scale to zero | ~$15 |
| Supabase Pro | 8 GB DB, 100 GB storage | $25 |
| GCS (CAD files) | ~50 GB | ~$2 |
| Cloudflare Free | CDN + WAF + DDoS | $0 |
| Upstash Redis | Free tier (10K commands/day) | $0 |
| Pub/Sub | ~10K messages/month | ~$0.04 |
| GCP Secret Manager | 6 secrets | $0 |
| Sentry Free | 5K errors/month | $0 |
| Resend Free | 3K emails/month | $0 |
| GCP Logging | <50 GB (free) | $0 |
| **Domain + DNS** | Cloudflare registrar | ~$12/year |
| | | |
| **TOTAL** | | **~$65/month** |

> [!NOTE]
> Yes, **$65/month (~₹5,400)**. This is possible because Cloud Run scales to zero and you only pay for actual requests/compute. Nights and weekends = $0.

### Tier 2: Growth (~$250/month, ~₹20,000)
**For: 100-500 daily users, 50-100 CAD files/day**

| Component | Change from Starter | Cost |
|-----------|-------------------|------|
| Cloud Run (Web) | Min 1 instance (eliminate cold starts) | ~$60 |
| Cloud Run (CAD Worker) | 0-10 instances | ~$75 |
| Supabase Pro | Same (upgrade to Team $599 if needed) | $25 |
| GCS | ~200 GB | ~$5 |
| Upstash Redis | Pro plan | $10 |
| Cloudflare Pro | More WAF rules, better analytics | $20 |
| Resend | Paid tier (50K emails) | $20 |
| Sentry | Team tier | $26 |
| **TOTAL** | | **~$250/month** |

### Tier 3: Scale (~$600-1,200/month, ~₹50,000-1,00,000)
**For: 500-2000 daily users, 200+ CAD files/day**

| Component | Change from Growth | Cost |
|-----------|-------------------|------|
| Cloud Run (Web) | Min 2 instances, max 20 | ~$150 |
| Cloud Run (CAD Worker) | Min 2 instances (always warm), max 50 | ~$300 |
| Supabase Team | $599 (or migrate to Cloud SQL) | $599 |
| GCS | ~1 TB | ~$20 |
| Upstash Redis | Enterprise | $50 |
| Cloudflare Business | Advanced WAF, SLA | $200 |

> [!TIP]
> **When to upgrade to the Premium AWS plan?** When monthly revenue exceeds ₹5 lakhs/month AND you need Multi-AZ, 99.95% SLA, and SOC 2 compliance for enterprise clients. Until then, this budget stack handles the load.

---

## 6. What We Keep vs What We Change

### ✅ Keep (Zero Code Changes)

| Component | Why Keep |
|-----------|---------|
| `src/lib/smartQuote/pricing.ts` | Core algorithm — perfectly engineered |
| `src/lib/supabase/client.ts` | Browser Supabase client — works as-is |
| `src/lib/supabase/server.ts` | Server Supabase client — works as-is |
| `src/lib/supabase/admin.ts` | Admin client — works as-is |
| All RLS policies in `supabase/migrations/` | Security foundation — keep every policy |
| All React components in `src/components/` | UI — no changes needed |
| All page routes (`/buyer`, `/vendor`, `/admin`) | Routing — works as-is |
| `src/proxy.ts` (Next.js 16 session middleware) | Auth flow — works as-is |
| `package.json` dependencies | All deps stay the same |

### 🔄 Change (Targeted Modifications)

| Component | What Changes | Effort |
|-----------|-------------|--------|
| `src/lib/smartQuote/server.ts` | CAD analysis becomes async (publish to Pub/Sub instead of synchronous HTTP call to Render) | 2 days |
| Pricing in browser | Remove `estimatePart()` from client bundle; add a `/api/preview-price` endpoint that returns numbers only | 1 day |
| File upload handler | Switch from Supabase Storage upload to GCS signed URL upload | 1 day |
| New: Pub/Sub worker | Python CAD worker reads from Pub/Sub, writes results back to Supabase | 2 days |
| New: `Dockerfile` | Containerize Next.js for Cloud Run | 0.5 day |
| New: `cloudbuild.yaml` | CI/CD pipeline for Cloud Build → Cloud Run | 0.5 day |
| Environment variables | Point to GCS bucket, Pub/Sub topic, Upstash Redis URL | 0.5 day |

**Total migration effort: ~7-8 days** (vs 4 weeks for the full AWS plan)

---

## 7. Migration Path — Minimal Code Changes

### Week 1: Infrastructure Setup (3 days)

```
Day 1:
  □ Create GCP project
  □ Enable APIs (Cloud Run, Pub/Sub, GCS, Secret Manager)
  □ Create GCS bucket for CAD files (private, encryption on)
  □ Create Pub/Sub topic + dead letter topic
  □ Store all secrets in Secret Manager

Day 2:
  □ Upgrade Supabase to Pro plan
  □ Select Singapore region (closest to India)
  □ Set up Cloudflare (point domain, enable proxy)
  □ Configure Cloudflare WAF rules + rate limiting

Day 3:
  □ Containerize Next.js app (Dockerfile)
  □ Deploy to Cloud Run (first test deployment)
  □ Containerize CAD worker (Dockerfile)
  □ Deploy worker to Cloud Run with Pub/Sub trigger
```

### Week 2: Code Changes + Security (4 days)

```
Day 4:
  □ Modify server.ts: async CAD analysis via Pub/Sub
  □ Add GCS signed URL upload handler
  □ Add Upstash Redis caching for sq_settings + rm_rates

Day 5:
  □ Remove estimatePart() from browser bundle
  □ Create /api/preview-price endpoint (returns numbers only)
  □ Add Supabase Realtime subscription for analysis status

Day 6:
  □ Set up CI/CD (GitHub Actions → Cloud Build → Cloud Run)
  □ Add Sentry error tracking (frontend + backend)
  □ Configure GCS access logging

Day 7:
  □ Add NDA acceptance table + workflow to Supabase
  □ Add audit logging for CAD file access
  □ End-to-end testing
  □ Deploy to production 🚀
```

---

## 8. Detailed Cost Breakdown

### Realistic Month 1-3 Scenario (Early Stage)

**Assumptions:** 50 daily active users, 15 CAD files uploaded/day, 200 quotes generated/day

| Service | Usage | Monthly Cost |
|---------|-------|-------------|
| **Cloud Run (Web)** | ~500K requests/month, avg 200ms | $8 |
| **Cloud Run (CAD Worker)** | 450 analyses/month, avg 30s each | $12 |
| **Supabase Pro** | 8 GB DB, 50 GB storage | $25 |
| **GCS** | 30 GB stored, 2 GB transfer | $2 |
| **Pub/Sub** | 15K messages/month | $0.01 |
| **Upstash Redis** | <10K commands/day (free tier) | $0 |
| **Cloudflare** | Free tier | $0 |
| **Secret Manager** | 6 secrets, 50K accesses | $0 |
| **GCP Logging** | ~5 GB/month (within free tier) | $0 |
| **Sentry** | Free tier | $0 |
| **Resend** | ~500 emails/month (free tier) | $0 |
| **Domain** | Annual / 12 | $1 |
| | | |
| **TOTAL** | | **~$48/month** |
| **In ₹** | | **~₹4,000/month** |

### Realistic Month 6-12 Scenario (Growth Stage)

**Assumptions:** 300 daily active users, 80 CAD files/day, 1000 quotes/day

| Service | Usage | Monthly Cost |
|---------|-------|-------------|
| **Cloud Run (Web)** | ~3M requests/month, min 1 instance | $55 |
| **Cloud Run (CAD Worker)** | 2,400 analyses/month | $50 |
| **Supabase Pro** | 8 GB DB, 200 GB storage | $25 |
| **GCS** | 200 GB stored, 15 GB transfer | $8 |
| **Pub/Sub** | 80K messages/month | $0.10 |
| **Upstash Redis** | Pro ($10) | $10 |
| **Cloudflare Pro** | Upgraded WAF | $20 |
| **Sentry Team** | More error volume | $26 |
| **Resend** | ~5K emails/month | $20 |
| **Domain** | Annual / 12 | $1 |
| | | |
| **TOTAL** | | **~$215/month** |
| **In ₹** | | **~₹18,000/month** |

---

## 9. Trade-offs — What You Give Up

> [!WARNING]
> The budget plan makes deliberate trade-offs. Here's what you're accepting:

| Trade-off | Impact | When to Upgrade |
|-----------|--------|----------------|
| **No Multi-AZ / DR** | If GCP asia-south1 goes down, your app goes down | When SLA >99.9% is contractually required |
| **Cold starts possible** | First request after idle period takes 2-5s | When always-instant response is needed (set min_instances=1, adds ~$40/mo) |
| **No customer-managed encryption** | Google manages the encryption keys (still AES-256) | When enterprise clients require CMEK for compliance |
| **Supabase is a vendor dependency** | If Supabase has issues, DB is affected | When you outgrow Supabase Pro (>8GB DB or need dedicated compute) |
| **Limited WAF rules** | Cloudflare Free gives 5 custom rules (usually enough) | When you need complex WAF logic (upgrade to Cloudflare Pro $20/mo) |
| **No distributed tracing** | Harder to debug cross-service latency issues | When you split into microservices |
| **Single Cloud Run region** | All traffic served from one region (e.g., asia-south1 Mumbai) | When you have global users needing <100ms latency |

### Decision Matrix: Budget vs Premium

```
Choose BUDGET plan if:
  ✅ You're pre-revenue or early revenue
  ✅ < 500 concurrent users
  ✅ Don't need Multi-AZ / 99.95% SLA
  ✅ Don't have enterprise compliance requirements
  ✅ Want to minimize burn rate
  ✅ Can accept 2-5s cold starts occasionally

Choose PREMIUM (AWS) plan if:
  ✅ Revenue > ₹5 lakh/month
  ✅ Serving enterprise clients with SLA requirements
  ✅ Need SOC 2 / ISO 27001 compliance
  ✅ Need customer-managed encryption keys
  ✅ > 500 concurrent users consistently
  ✅ Zero-cold-start is mandatory
```

---

## Summary

| Metric | Current (Free) | Budget Plan | Premium Plan |
|--------|---------------|-------------|-------------|
| **Monthly Cost** | ₹0 | **₹4,000 → ₹18,000** | ₹1,00,000 |
| **Code Changes** | — | **~7 days work** | ~4 weeks work |
| **Concurrent Users** | ~5 | **100-500** | 1000+ |
| **CAD Processing** | 60s cold start, 1 worker | **5s cold start, auto-scaled** | Always warm, 2-50 workers |
| **Security** | Basic | **Production-grade** | Enterprise-grade |
| **Scalability Ceiling** | Broken | **Can grow to 1000+ users** | Built for 1000+ from day 1 |
| **Migration Risk** | — | **Low (keep Supabase)** | High (full rewrite of infra) |

> [!IMPORTANT]
> **Recommendation:** Start with the **Budget Plan**. At **₹4,000-18,000/month**, you get production-grade security, auto-scaling CAD workers, and a clear upgrade path. Migrate to the Premium AWS plan only when monthly revenue justifies ₹1 lakh/month in infrastructure — likely when you're processing 200+ CAD files/day and serving enterprise clients with SLA requirements. The budget stack handles everything up to that point.
