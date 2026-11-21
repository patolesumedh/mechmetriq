---
title: "MECHmetrIQ — Production Deployment Blueprint"
document_type: "Step-by-Step Production Deployment Guide"
version: "2.1.0"
date: "2026-11-02"
author: "Lakshman Shrinivasan"
target_monthly_cost: "₹4,000–₹18,000/month ($48–$215)"
target_platform: "GCP Cloud Run + Supabase Pro + Cloudflare Free + Upstash Redis"
industrial_standards:
  - "CIS GCP Benchmark 5.1 (Public Access Prevention Enforced)"
  - "CIS Docker Benchmark 4.1 (Non-root container execution)"
  - "DPDP Act 2023 (Digital Personal Data Protection Act, 2023)"
  - "RFC 8446 (TLS 1.3)"
  - "FIPS 140-3 & FIPS 197 (AES-256 GCS encryption)"
status: "Execution Ready — Self-Contained"
---

# MECHmetrIQ — Production Deployment Blueprint

> **Purpose:** This is the complete, final guide for taking MECHmetrIQ from a laptop demo to a live, paying-customer product. It covers every account you need to create, every tool to install, every monthly bill to expect, how to organize your code, and how to test safely before going live.
>
> **Target Cost:** ₹4,000 – ₹18,000/month (depending on traffic)
>
> **No further architectural review needed.** This document is self-contained and ready to execute.

---

## Table of Contents

1. [Why This Architecture Is Optimal](#1-why-this-architecture-is-optimal)
2. [Complete Monthly Cost Breakdown](#2-complete-monthly-cost-breakdown)
3. [Everything You Need Before Day 1](#3-everything-you-need-before-day-1)
4. [Git Repository Structure](#4-git-repository-structure)
5. [Sandbox Environment — Test Before You Ship](#5-sandbox-environment--test-before-you-ship)
6. [Step-by-Step Deployment Guide](#6-step-by-step-deployment-guide)
7. [Optimizations That Save You Money](#7-optimizations-that-save-you-money)
8. [Caveats & Gotchas — Read This Carefully](#8-caveats--gotchas--read-this-carefully)
9. [When to Upgrade to the Premium Plan](#9-when-to-upgrade-to-the-premium-plan)

---

## 1. Why This Architecture Is Optimal

We evaluated 4 different hosting approaches. Here is why the **GCP Cloud Run + Supabase Pro** stack wins for a team that is pre-revenue or early-revenue:

| Approach | Monthly Cost | Migration Effort | Verdict |
| :--- | :--- | :--- | :--- |
| ❌ Stay on Free Tiers (Render + Vercel + Supabase Free) | ₹0 | 0 days | **Broken.** Crashes with 5 users. 60-second cold starts. No backups. No security. |
| ❌ Full AWS (ECS + RDS + ElastiCache + CloudFront) | ~₹1,00,000/mo | 4 weeks | **Overkill** for <500 users. Wastes money on always-running servers. |
| ❌ Heroku / Railway | ~₹25,000/mo | 1 week | **No scale-to-zero.** You pay 24/7 even when nobody is using the app at 3 AM. |
| ✅ **GCP Cloud Run + Supabase Pro + Cloudflare** | **₹4,000–₹18,000/mo** | **7 days** | **Pay only when someone uses the app.** Nights and weekends = ₹0. Keeps 90% of existing code unchanged. |

### The Three Killer Advantages

1. **Scale-to-Zero:** When no one is using the app (nights, weekends, holidays), the servers literally turn off. You pay ₹0 for idle time. This alone saves ₹15,000-₹80,000/month compared to always-on alternatives.

2. **90% Code Unchanged:** Because we keep Supabase (your database, login system, and file storage), almost all your existing code works as-is. No rewriting login pages, no migrating database tables, no changing how your app talks to the database.

3. **Security Without Enterprise Cost:** Cloudflare's free plan gives you the same DDoS protection and firewall that AWS charges ₹10,000/month for. Supabase's Row Level Security (already built in your code) prevents data leaks between customers.

---

## 2. Complete Monthly Cost Breakdown

### Stage 1: Launch Phase (Month 1–3)
**50 daily users, 15 CAD files/day, 200 quotes/day**

| Service | What It Does | Plan/Tier | Monthly Cost (USD) | Monthly Cost (₹) |
| :--- | :--- | :--- | :--- | :--- |
| GCP Cloud Run (Website) | Runs your Next.js website | Pay-per-request, 0-3 instances | $8 | ₹665 |
| GCP Cloud Run (CAD Worker) | Analyzes uploaded STEP files | Pay-per-file, 0-5 instances | $12 | ₹996 |
| GCP Pub/Sub | Message queue for CAD jobs | ~15K messages/month | $0.01 | ₹1 |
| GCP Cloud Storage | Stores uploaded CAD files | ~30 GB | $2 | ₹166 |
| GCP Secret Manager | Stores passwords & API keys | 6 secrets (free tier) | $0 | ₹0 |
| GCP Cloud Logging | Server logs | <50 GB (free tier) | $0 | ₹0 |
| Supabase Pro | Database + Login + File Storage | Pro Plan | $25 | ₹2,075 |
| Upstash Redis | Speed cache for pricing | Free tier (10K ops/day) | $0 | ₹0 |
| Cloudflare | DDoS protection + CDN + WAF | Free Plan | $0 | ₹0 |
| Sentry | Error tracking | Free (5K errors/mo) | $0 | ₹0 |
| Resend | Transactional emails | Free (3K emails/mo) | $0 | ₹0 |
| Domain (mechmetriq.com) | Your web address | Annual ÷ 12 | $1 | ₹83 |
| GitHub | Code repository | Free (public) or Team ($4/user) | $0–$4 | ₹0–₹332 |
| | | | | |
| **TOTAL** | | | **~$48–$52** | **~₹4,000–₹4,300** |

### Stage 2: Growth Phase (Month 6–12)
**300 daily users, 80 CAD files/day, 1000 quotes/day**

| Service | Change from Stage 1 | Monthly Cost (USD) | Monthly Cost (₹) |
| :--- | :--- | :--- | :--- |
| GCP Cloud Run (Website) | Keep 1 instance always warm (no cold starts) | $55 | ₹4,565 |
| GCP Cloud Run (CAD Worker) | 0-10 instances | $50 | ₹4,150 |
| GCP Cloud Storage | ~200 GB | $8 | ₹664 |
| Supabase Pro | Same | $25 | ₹2,075 |
| Upstash Redis | Pro plan | $10 | ₹830 |
| Cloudflare Pro | More WAF rules | $20 | ₹1,660 |
| Sentry Team | More error volume | $26 | ₹2,158 |
| Resend | 50K emails/month | $20 | ₹1,660 |
| GCP Pub/Sub | ~80K messages | $0.10 | ₹8 |
| Domain | Same | $1 | ₹83 |
| | | | |
| **TOTAL** | | **~$215** | **~₹17,850** |

### Stage 3: Scale Phase (When Revenue Justifies It)
**500+ daily users, 200+ CAD files/day**

| Service | Change | Monthly Cost |
| :--- | :--- | :--- |
| Cloud Run (Website) | Min 2 instances, max 20 | ~$150 |
| Cloud Run (CAD Worker) | Min 2 always warm, max 50 | ~$300 |
| Supabase Team | $599 (or migrate to GCP Cloud SQL) | $599 |
| Cloudflare Business | Advanced WAF, SLA guarantee | $200 |
| **TOTAL** | | **~$1,200 (~₹1,00,000)** |

> **Key Insight:** You only hit ₹1 lakh/month when you have 500+ daily users and 200+ files/day. At that point, your revenue should be ₹5-10 lakh/month, so the cost is <20% of revenue.

### Cost Comparison Summary

```
₹0/month         ₹4,000/month        ₹18,000/month       ₹1,00,000/month
    │                 │                    │                     │
    ▼                 ▼                    ▼                     ▼
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Current  │    │  STAGE 1     │    │  STAGE 2     │    │  STAGE 3     │
│ (Broken) │    │  Launch      │    │  Growth      │    │  Scale       │
│ 5 users  │    │  50 users    │    │  300 users   │    │  1000+ users │
│ No backup│    │  Production  │    │  Always-warm │    │  Enterprise  │
│ Crashes  │    │  grade       │    │  No cold     │    │  grade       │
│          │    │  7-day setup │    │  starts      │    │              │
└─────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

---

## 3. Everything You Need Before Day 1

### 3.1 Accounts to Create (One-Time Setup)

| # | Account | URL | Cost | What You Get | Who Creates It |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Google Cloud Platform (GCP)** | [console.cloud.google.com](https://console.cloud.google.com) | Free to create + $300 free credits for 90 days | Cloud Run, Cloud Storage, Pub/Sub, Secret Manager, Logging | Team lead |
| 2 | **Supabase** (upgrade existing to Pro) | [supabase.com](https://supabase.com) | $25/month | Database, Auth, File Storage, Realtime | Whoever manages current Supabase |
| 3 | **Cloudflare** | [cloudflare.com](https://cloudflare.com) | Free | DDoS protection, CDN, WAF, SSL certificates | Team lead |
| 4 | **Upstash** | [console.upstash.com](https://console.upstash.com) | Free tier | Serverless Redis cache | Any developer |
| 5 | **Sentry** | [sentry.io](https://sentry.io) | Free tier | Error tracking (frontend + backend) | Any developer |
| 6 | **Resend** | [resend.com](https://resend.com) | Free tier | Transactional emails | Any developer |
| 7 | **GitHub** (already have) | [github.com](https://github.com) | Free | Code repo + CI/CD (GitHub Actions) | Already set up |
| 8 | **Razorpay** | [razorpay.com](https://razorpay.com) | 2% per transaction (no monthly fee) | Payment gateway (UPI, cards, netbanking) | Business owner (needs PAN, bank account) |
| 9 | **Docker Hub** (optional) | [hub.docker.com](https://hub.docker.com) | Free | Container image storage (or use GCP Artifact Registry) | Any developer |

**Total one-time account setup time:** ~2 hours.

### 3.2 Software to Install on Developer Machines

| # | Tool | Install Command (macOS/Linux) | Install Command (Windows) | Why You Need It |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Node.js 20+** | `brew install node@20` | Download from [nodejs.org](https://nodejs.org) | Runs your Next.js website |
| 2 | **Python 3.11+** | `brew install python@3.11` | Download from [python.org](https://python.org) | Runs the CAD parser locally |
| 3 | **Docker Desktop** | `brew install --cask docker` | Download from [docker.com](https://docker.com/products/docker-desktop) | Packages your app into containers |
| 4 | **Google Cloud CLI (`gcloud`)** | `brew install google-cloud-sdk` | Download from [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install) | Deploys code to GCP Cloud Run |
| 5 | **Git** | `brew install git` | Download from [git-scm.com](https://git-scm.com) | Version control (already installed) |
| 6 | **VS Code or Cursor** | [code.visualstudio.com](https://code.visualstudio.com) | Same | Code editor (already using) |
| 7 | **Supabase CLI** (optional) | `npm install -g supabase` | `npm install -g supabase` | Run database migrations locally |

**Install everything in order.** Docker Desktop needs to be running whenever you build or test containers.

### 3.3 API Keys and Secrets to Generate

Generate these once and store them in a password manager (Bitwarden, 1Password, or a shared Google Doc with restricted access):

```
Secret #1: SMARTQUOTE_API_KEY
   How to generate: Run this in terminal → openssl rand -hex 32
   Example output:  a3f8c2d1e9b0f4a567890123456789abcdef0123456789abcdef0123456789ab
   Used by: CAD parser service (to verify requests are from your website, not hackers)

Secret #2: SUPABASE_SERVICE_ROLE_KEY
   Where to find: Supabase Dashboard → Project Settings → API → service_role (secret)
   Used by: Server-side code that bypasses Row Level Security (e.g., writing CAD analysis results)
   ⚠️ DANGER: NEVER put this in frontend code or browser environment variables!

Secret #3: UPSTASH_REDIS_REST_TOKEN
   Where to find: Upstash Dashboard → Your Database → REST API → Token
   Used by: Rate limiting and pricing cache

Secret #4: SENTRY_DSN
   Where to find: Sentry Dashboard → Project Settings → Client Keys (DSN)
   Used by: Error tracking

Secret #5: RESEND_API_KEY
   Where to find: Resend Dashboard → API Keys → Create
   Used by: Sending transactional emails (quote ready, order updates)

Secret #6: RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET
   Where to find: Razorpay Dashboard → Settings → API Keys
   Used by: Payment processing
```

### 3.4 Domain & DNS Setup

| Step | Action | Time |
| :--- | :--- | :--- |
| 1 | Buy domain `mechmetriq.com` (or `.in`) from any registrar (GoDaddy, Namecheap, Cloudflare Registrar) | 5 min |
| 2 | In your registrar, change nameservers to Cloudflare's nameservers (shown in Cloudflare dashboard) | 5 min |
| 3 | In Cloudflare, add a CNAME record pointing `mechmetriq.com` to your Cloud Run service URL | 5 min |
| 4 | In Cloudflare, enable: SSL → Full (Strict), Security → Bot Fight Mode, WAF → Managed Rules | 10 min |

---

## 4. Git Repository Structure

### 4.1 Recommended Monorepo Layout

Your current repo already follows a good pattern. Here is the optimized production structure with new files highlighted:

```
mechmetriq/
│
├── .github/                          # ← NEW: CI/CD automation
│   └── workflows/
│       ├── deploy-web.yml            # Auto-deploy website on merge to main
│       ├── deploy-cad-worker.yml     # Auto-deploy CAD parser on merge to main
│       ├── preview.yml               # Deploy sandbox for pull requests
│       └── test.yml                  # Run tests on every push
│
├── services/
│   └── smartquote/                   # Python CAD parser service (EXISTING)
│       ├── app/
│       │   ├── __init__.py
│       │   ├── main.py               # FastAPI routes
│       │   ├── analyze.py            # Analysis pipeline coordinator
│       │   ├── poc_parsing.py        # Core geometry engine (6,197 lines — THE IP)
│       │   └── thumbnail.py          # 3D preview image generator
│       ├── Dockerfile                # Container definition (EXISTING)
│       ├── requirements.txt          # Python dependencies (EXISTING)
│       ├── cloudbuild.yaml           # ← NEW: GCP Cloud Build config
│       └── samples/                  # Test STEP files
│
├── src/                              # Next.js application (EXISTING)
│   ├── app/                          # Page routes
│   │   ├── buyer/                    # Buyer dashboard, quotes, orders
│   │   ├── vendor/                   # Vendor portal (fabrication + raw material)
│   │   ├── admin/                    # Admin panel, Smart Quote rates
│   │   ├── auth/                     # Login, register, MFA
│   │   └── api/                      # ← NEW: API routes
│   │       ├── preview-price/        # ← NEW: Returns price numbers only (no algorithm)
│   │       └── webhook/              # ← NEW: Payment webhooks
│   ├── components/                   # React UI components
│   ├── lib/
│   │   ├── smartQuote/
│   │   │   ├── pricing.ts            # THE core pricing algorithm (KEEP — server only)
│   │   │   ├── server.ts             # Server-side CAD analysis calls
│   │   │   ├── shared.ts             # Type definitions
│   │   │   └── options.ts            # Material/finish/tolerance options
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   ├── server.ts             # Server Supabase client
│   │   │   └── admin.ts              # Service-role client (NEVER in browser)
│   │   ├── cache/                    # ← NEW: Upstash Redis caching
│   │   │   ├── redis.ts              # Redis client setup
│   │   │   └── rate-limiter.ts       # Per-user rate limiting
│   │   └── storage/                  # ← NEW: GCS signed URL helpers
│   │       └── gcs.ts                # Generate signed upload/download URLs
│   └── proxy.ts                      # Session cookie middleware (EXISTING)
│
├── supabase/
│   ├── migrations/                   # Database schema changes (0001 → 0020)
│   ├── scripts/
│   └── seed.sql
│
├── infra/                            # ← NEW: Infrastructure configuration
│   ├── cloud-run/
│   │   ├── web-service.yaml          # Cloud Run config for website
│   │   └── cad-worker-service.yaml   # Cloud Run config for CAD parser
│   ├── pubsub/
│   │   └── topics.yaml               # Pub/Sub topic definitions
│   └── gcs/
│       └── buckets.yaml              # Cloud Storage bucket configs
│
├── Dockerfile                        # ← NEW: Container for Next.js website
├── docker-compose.yml                # ← NEW: Run everything locally for testing
├── .env.example                      # ← NEW: Template of all required env vars
├── .gitignore                        # EXISTING (ensure .env is listed!)
├── package.json                      # EXISTING
├── package-lock.json                 # EXISTING
├── next.config.ts                    # EXISTING
├── tsconfig.json                     # EXISTING
└── README.md                         # EXISTING
```

### 4.2 Key Rules for the Team

| Rule | Why |
| :--- | :--- |
| **Never commit `.env` files** | Contains passwords. Add `.env` to `.gitignore`. Use `.env.example` as a template (with dummy values). |
| **Never push directly to `main` branch** | All changes go through Pull Requests. This triggers the sandbox environment automatically. |
| **One feature = one branch** | Create branches like `feature/razorpay-integration` or `fix/cold-start-timeout`. |
| **Keep `poc_parsing.py` changes minimal** | This 6,197-line file is the core IP. Small, targeted changes only. Every change needs a test. |
| **Tag releases** | Use `v1.0.0`, `v1.1.0` etc. This lets you roll back if a deployment breaks something. |

---

## 5. Sandbox Environment — Test Before You Ship

### 5.1 The Problem

Right now, when you merge code to `main`, it goes straight to production. If the code has a bug, your paying customers see the bug. This is dangerous.

### 5.2 The Solution: Automatic Preview Environments

Every time a developer creates a **Pull Request** (PR) on GitHub, the system automatically:
1. Builds a temporary copy of the website
2. Deploys it to a unique URL like `https://pr-42---mechmetriq-web-abc123.a.run.app`
3. Connects it to a **separate test database** (Supabase staging project)
4. Lets the team test the changes at that URL
5. Automatically deletes the temporary deployment when the PR is merged or closed

**Cost of this sandbox system: ~$0–$2 per Pull Request** (because Cloud Run charges only for actual usage, and test environments are used for a few minutes at most).

### 5.3 How to Set This Up

#### Step 1: Create a Supabase Staging Project ($0 — Free Tier)

Create a **second Supabase project** called `mechmetriq-staging` on the free tier. This is your test database.

```
mechmetriq (Pro, $25/mo) ← Production (real customer data)
mechmetriq-staging (Free, $0/mo) ← Testing (fake test data)
```

Run all your migrations against both projects. Use `supabase db push` to keep them in sync.

#### Step 2: GitHub Actions Workflow for Preview Deployments

Create this file in your repo:

```yaml
# .github/workflows/preview.yml
name: Preview Environment

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Build and Push Docker Image
        run: |
          gcloud builds submit \
            --tag gcr.io/${{ secrets.GCP_PROJECT_ID }}/mechmetriq-web:pr-${{ github.event.pull_request.number }} \
            --timeout=600s

      - name: Deploy Preview to Cloud Run
        id: deploy
        run: |
          gcloud run deploy mechmetriq-preview-pr-${{ github.event.pull_request.number }} \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/mechmetriq-web:pr-${{ github.event.pull_request.number }} \
            --region asia-south1 \
            --platform managed \
            --min-instances 0 \
            --max-instances 2 \
            --memory 512Mi \
            --cpu 1 \
            --allow-unauthenticated \
            --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=${{ secrets.STAGING_SUPABASE_URL }}" \
            --set-env-vars "NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.STAGING_SUPABASE_ANON_KEY }}" \
            --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=${{ secrets.STAGING_SUPABASE_SERVICE_ROLE_KEY }}" \
            --set-env-vars "SMARTQUOTE_API_URL=${{ secrets.STAGING_SMARTQUOTE_URL }}" \
            --set-env-vars "SMARTQUOTE_API_KEY=${{ secrets.SMARTQUOTE_API_KEY }}" \
            --format='value(status.url)'
          
          echo "url=$(gcloud run services describe mechmetriq-preview-pr-${{ github.event.pull_request.number }} --region asia-south1 --format='value(status.url)')" >> $GITHUB_OUTPUT

      - name: Comment Preview URL on PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `🚀 **Preview deployed!**\n\nTest this PR at: ${{ steps.deploy.outputs.url }}\n\n_This preview uses the staging database (not real customer data)._`
            })
```

#### Step 3: Auto-Cleanup When PR is Closed

```yaml
# .github/workflows/preview-cleanup.yml
name: Cleanup Preview

on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Delete Preview Service
        run: |
          gcloud run services delete mechmetriq-preview-pr-${{ github.event.pull_request.number }} \
            --region asia-south1 \
            --quiet || true
```

### 5.4 Sandbox Cost Breakdown

| Item | Cost |
| :--- | :--- |
| Supabase Staging Project (Free Tier) | $0/month |
| Cloud Run Preview Deployments (scale-to-zero) | ~$0.01–$0.50 per PR (actual compute used during testing only) |
| GitHub Actions CI/CD Minutes | Free (2,000 min/month included) |
| GCP Cloud Build (building Docker images) | Free (120 build-min/day included) |
| **TOTAL** | **~$0–$2/month** |

### 5.5 Local Development Setup (Even Cheaper: $0)

For day-to-day coding, developers don't need cloud environments at all. Use Docker Compose to run everything on your laptop:

```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - SMARTQUOTE_API_URL=http://cad-worker:8000
      - SMARTQUOTE_API_KEY=dev-key-12345
    depends_on:
      - cad-worker

  cad-worker:
    build: ./services/smartquote
    ports:
      - "8000:8000"
    environment:
      - SMARTQUOTE_API_KEY=dev-key-12345
      - WEB_CONCURRENCY=1
```

Run with: `docker compose up` — everything runs locally, no cloud costs.

---

## 6. Step-by-Step Deployment Guide

### Day 1: Google Cloud + Cloudflare Setup (3 hours)

```
□ 1.1  Create GCP account at console.cloud.google.com
       → Claim the $300 free credit (valid 90 days)
       
□ 1.2  Create a new GCP Project called "mechmetriq-prod"
       → Note the Project ID (e.g., mechmetriq-prod-abc123)

□ 1.3  Enable these GCP APIs (run in Cloud Shell or terminal):
       gcloud services enable \
         run.googleapis.com \
         pubsub.googleapis.com \
         storage.googleapis.com \
         secretmanager.googleapis.com \
         cloudbuild.googleapis.com \
         artifactregistry.googleapis.com

□ 1.4  Create Cloud Storage bucket for CAD files:
       gcloud storage buckets create gs://mechmetriq-cad-files \
         --location=asia-south1 \
         --default-storage-class=STANDARD \
         --uniform-bucket-level-access \
         --public-access-prevention

□ 1.5  Create Pub/Sub topic + dead letter topic:
       gcloud pubsub topics create cad-analysis-jobs
       gcloud pubsub topics create cad-analysis-deadletter
       gcloud pubsub subscriptions create cad-analysis-sub \
         --topic=cad-analysis-jobs \
         --dead-letter-topic=cad-analysis-deadletter \
         --max-delivery-attempts=3

□ 1.6  Store secrets in GCP Secret Manager:
       echo -n "your-64-char-api-key" | \
         gcloud secrets create SMARTQUOTE_API_KEY --data-file=-
       (repeat for each secret listed in Section 3.3)

□ 1.7  Create Cloudflare account → Add your domain
       → Change nameservers at your registrar
       → Wait for DNS propagation (up to 24 hours, usually 30 min)

□ 1.8  In Cloudflare Dashboard:
       → SSL/TLS: Full (Strict)
       → Security → WAF: Enable Managed Rules
       → Security → Bots: Enable Bot Fight Mode
       → Security → Rate Limiting: Create rule
         "When URI Path contains /api/ → Rate limit to 60 requests per minute"
```

### Day 2: Supabase + Upstash Setup (1 hour)

```
□ 2.1  Upgrade existing Supabase project to Pro ($25/month)
       → Dashboard → Organization → Billing → Upgrade to Pro
       → Select region: Singapore (ap-southeast-1) — closest to India

□ 2.2  Note down Supabase connection details:
       → Settings → Database → Connection String (with Supavisor pooling, port 6543)
       → Settings → API → anon key (for browser)
       → Settings → API → service_role key (for server — KEEP SECRET)

□ 2.3  Create Upstash Redis database:
       → console.upstash.com → Create Database
       → Region: AWS ap-south-1 (Mumbai)
       → Note: REST URL and REST Token

□ 2.4  Create Supabase Staging project (free tier):
       → New Project → "mechmetriq-staging"
       → Run all existing migrations:
         npx supabase db push --db-url="your-staging-db-url"
```

### Day 3: Deploy CAD Worker to Cloud Run (2 hours)

```
□ 3.1  Build the CAD worker Docker image:
       cd services/smartquote
       gcloud builds submit \
         --tag gcr.io/mechmetriq-prod-abc123/cad-worker:v1 \
         --timeout=900s
       (This takes ~10 minutes because OpenCASCADE is large)

□ 3.2  Deploy to Cloud Run:
       gcloud run deploy mechmetriq-cad-worker \
         --image gcr.io/mechmetriq-prod-abc123/cad-worker:v1 \
         --platform managed \
         --region asia-south1 \
         --memory 2Gi \
         --cpu 2 \
         --min-instances 0 \
         --max-instances 20 \
         --concurrency 1 \
         --timeout 300s \
         --set-secrets "SMARTQUOTE_API_KEY=SMARTQUOTE_API_KEY:latest" \
         --no-allow-unauthenticated

□ 3.3  Test the worker:
       → Get the service URL from deployment output
       → Run: curl -H "X-API-Key: your-key" -F file=@samples/turned_lid.step <URL>/analyze
       → Should return JSON geometry in ~2-5 seconds
```

### Day 4: Deploy Website to Cloud Run (2 hours)

```
□ 4.1  Create Dockerfile for Next.js (at repo root):
       (See the Dockerfile in Section 4.1 of the budget architecture doc)

□ 4.2  Build and deploy:
       gcloud builds submit \
         --tag gcr.io/mechmetriq-prod-abc123/web:v1 \
         --timeout=600s

       gcloud run deploy mechmetriq-web \
         --image gcr.io/mechmetriq-prod-abc123/web:v1 \
         --platform managed \
         --region asia-south1 \
         --memory 512Mi \
         --cpu 1 \
         --min-instances 0 \
         --max-instances 10 \
         --concurrency 80 \
         --timeout 60s \
         --set-env-vars "NODE_ENV=production" \
         --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co" \
         --set-env-vars "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ..." \
         --set-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
         --set-secrets "SMARTQUOTE_API_KEY=SMARTQUOTE_API_KEY:latest" \
         --set-env-vars "SMARTQUOTE_API_URL=https://mechmetriq-cad-worker-xxx.a.run.app" \
         --allow-unauthenticated

□ 4.3  Map your custom domain:
       gcloud run domain-mappings create \
         --service mechmetriq-web \
         --domain mechmetriq.com \
         --region asia-south1

□ 4.4  In Cloudflare, add CNAME record pointing to the Cloud Run domain
```

### Day 5: Code Changes (1 day)

```
□ 5.1  Install Upstash packages:
       npm install @upstash/redis @upstash/ratelimit

□ 5.2  Add rate limiting to API routes (src/lib/cache/rate-limiter.ts)

□ 5.3  Add GCS signed URL helpers (src/lib/storage/gcs.ts)
       npm install @google-cloud/storage

□ 5.4  Modify server.ts to publish CAD jobs to Pub/Sub instead of
       synchronous HTTP call to Render

□ 5.5  Add /api/preview-price route that returns pricing numbers
       without exposing the algorithm logic in the browser

□ 5.6  Install Sentry:
       npm install @sentry/nextjs
       npx @sentry/wizard@latest -i nextjs
```

### Day 6: Testing (1 day)

```
□ 6.1  Upload test STEP files (5MB, 25MB, 45MB)
□ 6.2  Verify quote generation works end-to-end
□ 6.3  Test error cases: invalid files, corrupt files, oversized files
□ 6.4  Check Sentry for any errors
□ 6.5  Verify Cloudflare WAF is blocking suspicious requests
□ 6.6  Run a simple load test (10 concurrent uploads)
```

### Day 7: Go Live

```
□ 7.1  Point DNS to production Cloud Run service
□ 7.2  Verify SSL/HTTPS works correctly
□ 7.3  Set up BetterStack uptime monitoring (free, 10 monitors)
       → Monitor: https://mechmetriq.com/health (check every 5 min)
□ 7.4  Create a rollback plan: tag the current working deployment as v1-stable
□ 7.5  🎉 Ship it!
```

---

## 7. Optimizations That Save You Money

### 7.1 File Deduplication Cache (Saves ~40% compute)

If the same STEP file is uploaded twice (same customer re-quoting, or common standard parts), compute the SHA-256 hash before sending it to the CAD worker. If the hash matches a previous analysis, return cached results instantly — no need to re-parse.

**Savings:** If 40% of uploads are duplicates, you save ~40% on CAD worker costs (~₹400-₹1,600/month).

### 7.2 Auto-Delete Old CAD Files (Saves storage costs)

Set a Cloud Storage lifecycle rule to automatically delete CAD files after 90 days. Most clients don't need files after the quote is accepted or rejected.

```bash
gsutil lifecycle set lifecycle.json gs://mechmetriq-cad-files
```

```json
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 90}
    }
  ]
}
```

### 7.3 Right-Size Container Memory

The CAD worker currently requests 2 GB RAM. Monitor actual usage in Cloud Run metrics after 2 weeks. If 95% of files peak at 1.2 GB, reduce to 1.5 GB — saves ~25% on compute costs.

### 7.4 Use `min-instances: 0` Until You Have Consistent Traffic

Cold starts on Cloud Run take 3–8 seconds. For early stage, this is acceptable. Only set `min-instances: 1` (always-warm) when you have paying customers who complain about the first-load delay. This single change costs an extra ~₹3,300/month.

### 7.5 GCP Committed Use Discounts (Stage 3 only)

When traffic is predictable, buy 1-year committed use contracts on Cloud Run for 17% savings. Only do this when monthly spend exceeds ₹50,000.

---

## 8. Caveats & Gotchas — Read This Carefully

### 🔴 Critical — Will Cause Problems if Ignored

| Caveat | What Happens if You Ignore It | How to Avoid It |
| :--- | :--- | :--- |
| **Supabase Pro is in Singapore, Cloud Run is in Mumbai** | Every database query crosses countries (~30ms latency added). | Accept the 30ms latency for now. It's not noticeable to users. Migrate to GCP Cloud SQL in Mumbai only when P95 latency becomes a problem. |
| **Cloud Run cold starts take 3–8 seconds** | The first visitor after 15 minutes of silence waits longer. | Accept for Stage 1. Set `min-instances: 1` in Stage 2 (adds ~₹3,300/month). |
| **`poc_parsing.py` uses `fork` for multiprocessing** | `fork` doesn't work on macOS with Python 3.12+ (segfaults). Works fine on Linux/Docker. | Always test the CAD worker inside Docker, never directly on macOS. |
| **Supabase Free Tier (staging) pauses after 7 days of inactivity** | Your staging database goes offline. You need to manually unpause it in the dashboard. | Run at least 1 query per week against staging, or accept manual unpausing before testing. |
| **GitHub Secrets must be set for CI/CD to work** | Preview deployments will fail if any secret is missing. | Add all secrets listed in Section 3.3 to GitHub → Settings → Secrets and Variables → Actions. |

### 🟡 Important — Performance & Cost Gotchas

| Caveat | Details |
| :--- | :--- |
| **GCP Cloud Build has a 120-min/day free tier** | The CAD worker Docker image takes ~10 minutes to build (OpenCASCADE is huge). You get ~12 free builds/day. If you build more, it costs $0.003/build-minute. |
| **Large STEP files (>25MB) may timeout** | Cloud Run has a max timeout of 300 seconds. If a STEP file takes longer to parse, the request fails. Mitigation: use Pub/Sub async processing (the worker has up to 600s). |
| **Cloudflare Free WAF has only 5 custom rules** | Enough for basic protection (rate limiting, country blocking, bot detection). If you need more complex rules, upgrade to Cloudflare Pro ($20/month). |
| **No Multi-AZ / Disaster Recovery** | If GCP's Mumbai region goes down (rare, ~1 hour/year), your app is offline. Acceptable for Stage 1-2. Add multi-region in Stage 3. |
| **Supabase Realtime has connection limits** | Pro plan allows ~500 concurrent WebSocket connections. If you hit this, upgrade to Supabase Team ($599/month) or switch to polling. |
| **The `fork` context in `main.py` loads CadQuery once** | The first analysis request is slow (~5s extra) because it loads OpenCASCADE into memory. Subsequent requests reuse the loaded library. |

### 🟢 Non-Issues (Things That Sound Scary but Are Fine)

| Concern | Why It's Fine |
| :--- | :--- |
| "GCP encryption is Google-managed, not customer-managed" | Google-managed encryption is still AES-256 at rest. The only difference: Google holds the key, not you. For 99% of manufacturing clients, this is acceptable. Add CMEK ($1/key/month) only if an enterprise client contractually requires it. |
| "Supabase is a third-party vendor — what if they go down?" | Supabase has 99.9% uptime SLA on Pro. They use AWS under the hood. Their outage history is excellent. If you ever need to migrate, Supabase is standard PostgreSQL — you can `pg_dump` and restore to any Postgres host in 1 hour. |
| "No dedicated VPC / private networking" | Cloud Run uses Google's internal network. Traffic between Cloud Run services never touches the public internet. Supabase connections use SSL. This is sufficient for the threat model (CNC manufacturing quotes, not nuclear secrets). |

---

## 9. When to Upgrade to the Premium Plan

This budget architecture is designed to grow with your business. Here's the decision tree:

```
Are you making ₹5+ lakh/month in revenue?
  │
  ├── NO → Stay on Budget Plan
  │
  └── YES → Do any of these apply?
              │
              ├── Enterprise client requires SOC 2 / ISO 27001 certification?
              │     → Upgrade to Premium (AWS) Plan
              │
              ├── Need 99.95% uptime SLA (contractually)?
              │     → Upgrade to Premium (AWS) Plan
              │
              ├── Processing 200+ CAD files per day consistently?
              │     → Upgrade to Premium (AWS) Plan
              │
              ├── Enterprise client requires customer-managed encryption keys?
              │     → Add CMEK to current plan ($1/key/month) — don't need full upgrade
              │
              └── None of the above?
                    → Stay on Budget Plan, it handles up to 500 concurrent users
```

### The Upgrade Path is Smooth

Because we're using containers (Docker), moving from GCP Cloud Run to AWS ECS Fargate requires:
1. Push the same Docker image to AWS ECR (Amazon's container registry)
2. Create ECS task definitions pointing to the image
3. Set up ALB + CloudFront + WAF
4. Migrate Supabase → RDS PostgreSQL
5. Migrate GCS → S3

**Estimated effort:** 2–3 weeks with an experienced cloud engineer.

---

## Quick-Reference Checklist

```
ACCOUNTS (create once):
  □ Google Cloud Platform (console.cloud.google.com)
  □ Supabase Pro upgrade ($25/month)
  □ Supabase Staging (free, for testing)
  □ Cloudflare (free)
  □ Upstash Redis (free)
  □ Sentry (free)
  □ Resend (free)
  □ Razorpay (2% per transaction)

SOFTWARE (install on each developer machine):
  □ Node.js 20+
  □ Python 3.11+
  □ Docker Desktop
  □ Google Cloud CLI (gcloud)
  □ Git

SECRETS (generate once, store in password manager):
  □ SMARTQUOTE_API_KEY (openssl rand -hex 32)
  □ SUPABASE_SERVICE_ROLE_KEY (from Supabase dashboard)
  □ UPSTASH_REDIS_REST_TOKEN (from Upstash dashboard)
  □ SENTRY_DSN (from Sentry dashboard)
  □ RESEND_API_KEY (from Resend dashboard)
  □ RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET (from Razorpay dashboard)

MONTHLY COSTS:
  □ Stage 1 (launch): ~₹4,000/month
  □ Stage 2 (growth): ~₹18,000/month
  □ Stage 3 (scale):  ~₹1,00,000/month
```
