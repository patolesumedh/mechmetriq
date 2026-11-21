---
title: "MECHmetrIQ — Architecture Review & Production-Grade Redesign"
document_type: "Full Cloud Architecture Review & Production Redesign"
version: "2.1.0"
date: "2026-11-02"
author: "Lakshman Shrinivasan (Review for Sumedh Patole)"
target_platform: "AWS Primary (ECS Fargate + RDS + CloudFront) / GCP Alternative"
industrial_standards:
  - "SOC 2 Type II (Security, Confidentiality)"
  - "ISO/IEC 27001:2022 (ISMS)"
  - "NIST SP 800-53 Rev. 5"
  - "DPDP Act 2023 (Digital Personal Data Protection Act, 2023)"
  - "GDPR (EU 2016/679)"
  - "FIPS 140-3 & FIPS 197 (AES-256)"
  - "RFC 8446 (TLS 1.3)"
  - "ISO 10303 (STEP AP203/AP214/AP242)"
status: "Production Blueprint"
---

# MECHmetrIQ — Architecture Review & Production-Grade Redesign

> **Prepared by:** Lakshman Shrinivasan (Review for Sumedh Patole)
> **Date:** 30 October 2026
> **Repo:** [patolesumedh/mechmetriq](https://github.com/patolesumedh/mechmetriq)
> **Competitor Benchmark:** [mechhub.in](https://mechhub.in)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture — As-Is Analysis](#2-current-architecture--as-is-analysis)
3. [Core Algorithm Deep-Dive](#3-core-algorithm-deep-dive--smart-quote-engine)
4. [Critical Issues in Current Architecture](#4-critical-issues-in-current-architecture)
5. [Competitor & Market Gap Analysis](#5-competitor--market-gap-analysis)
6. [Proposed Production Architecture (AWS / GCP)](#6-proposed-production-architecture)
7. [Security Architecture — CAD IP Protection](#7-security-architecture--cad-ip-protection)
8. [Differentiators — What Doesn't Exist in the Market](#8-differentiators--what-doesnt-exist-in-the-market)
9. [Migration Roadmap](#9-migration-roadmap)
10. [Cost Estimation](#10-cost-estimation)

---

## 1. Executive Summary

MECHmetrIQ is a **CAD-to-Quote platform** that lets buyers upload STEP/CAD files, get instant CNC machining cost estimates (configurable by material, tolerance, finish, quantity), and connect with fabrication/raw-material vendors. The current architecture is a **vibe-coded MVP** built on free-tier services (Vercel + Supabase + Render) — perfect for demos but **fundamentally unfit** for production with 1000s of concurrent users.

### Key Findings

| Area | Current State | Risk Level |
|------|--------------|------------|
| **Scalability** | Single Render free-tier container (1 worker, sleeps after 15 min) | 🔴 Critical |
| **CAD File Security** | Files stored in Supabase Storage (shared S3), transmitted to Render in plain multipart | 🔴 Critical |
| **Architecture Pattern** | Monolithic Next.js on Vercel + synchronous CAD analysis | 🟠 High |
| **Database** | Single Supabase Postgres, no read replicas, no connection pooling config | 🟠 High |
| **Payment** | Simulated (no real payment processor) | 🟡 Medium |
| **Monitoring/Observability** | None — no APM, no logging pipeline, no alerting | 🔴 Critical |
| **CI/CD** | GitHub → Vercel auto-deploy only, no staging environment | 🟡 Medium |
| **Core Algorithm** | Well-designed pure-function pricing engine; the actual IP of the platform | 🟢 Strong |

---

## 2. Current Architecture — As-Is Analysis

### 2.1 Topology Diagram (What Exists Today)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER                                     │
│  Buyer  │  Vendor (Fab/RM)  │  Admin                                │
│  ────── role-routed by Supabase RLS ──────                          │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────┐
│              VERCEL — Next.js 16.3.1             │
│  App Router · Turbopack · React 19 · Tailwind v4 │
│                                                   │
│  src/proxy.ts — session cookie refresh per req    │
│  Server Components + Server Actions (no REST)     │
│  /buyer · /vendor/fabrication · /vendor/raw_mat   │
│  /admin/smart-quote — rate card editor            │
│                                                   │
│  📦 src/lib/smartQuote/pricing.ts                 │
│     └─ estimatePart() — THE core pricing function │
│        Runs TWICE: browser preview + server trust │
│                                                   │
│  Supabase client variants:                        │
│    client.ts → anon key (browser)                 │
│    server.ts → anon key + cookie (RLS enforced)   │
│    admin.ts  → service-role key (bypasses RLS)    │
└──────────┬────────────────┬──────────────────────┘
           │                │
     ①Download STEP   ②POST /analyze
     from storage      multipart + X-API-Key
           │                │
           ▼                ▼
┌──────────────┐   ┌────────────────────────┐
│   SUPABASE   │   │  RENDER — FastAPI       │
│              │   │  Python · Docker         │
│ Postgres     │   │  CadQuery 2.8            │
│ GoTrue Auth  │   │  (OpenCascade kernel)    │
│ Storage(S3)  │   │                          │
│              │   │  POST /analyze → geometry │
│ Tables:      │   │  (bbox, volume, area,    │
│ sq_settings  │   │   features, thumbnail)   │
│ rm_materials │   │                          │
│ rm_grades    │   │  ❌ Free plan: sleeps    │
│ rm_rates     │   │     15 min, ~60s cold    │
│ cad_analyses │   │     start, 512MB/0.1 CPU │
│              │   │  ❌ 1 worker only        │
│ RLS per role │   │  ❌ No Supabase creds    │
│              │   │     (stateless, good)     │
└──────────────┘   └────────────────────────────┘
```

### 2.2 Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend + Backend | Next.js (App Router) | 16.3.1 |
| UI Framework | React + Tailwind CSS v4 | React 19.2.8 |
| Auth | Supabase GoTrue (JWT httpOnly cookie) | via `@supabase/ssr 0.12` |
| Database | Supabase Postgres + RLS | `supabase-js 2.112` |
| File Storage | Supabase Storage (S3-compatible) | Buckets: `rfq-attachments`, `kyc-docs` |
| CAD Geometry Parser | CadQuery 2.8 (OpenCascade) + FastAPI | Python on Render (Docker) |
| Deployment | Vercel (Next.js) + Render (Python) | Free tiers |
| Payment | Simulated UPI/Card/Wallet | No real processor |

### 2.3 Data Flow — How a Quote Gets Generated

```
User uploads .STEP file
        │
        ▼
① Vercel Server Action saves file to Supabase Storage
   Creates a `cad_analyses` row (status: pending)
        │
        ▼
② Vercel downloads the STEP file from Supabase Storage
   POSTs it as multipart to Render's /analyze endpoint
   (with X-API-Key header)
        │
        ▼
③ Render (CadQuery/OpenCascade) parses the STEP file:
   → bounding box (mm)
   → volume (mm³)
   → surface area (mm²)
   → solid count
   → rotational flag (milling vs turning)
   → feature detection (holes, threads, pockets, slots, bosses, edges...)
   → PNG thumbnail via matplotlib
   Returns JSON geometry (NO pricing — geometry only)
        │
        ▼
④ Vercel receives geometry, writes to `cad_analyses` table
   via admin.ts (service-role, bypasses RLS)
        │
        ▼
⑤ estimatePart() in pricing.ts computes the price:
   ┌─────────────────────────────────────────────┐
   │  Material Cost                               │
   │  = stock_weight_kg × ₹/kg × (1 + scrap%)    │
   │                                               │
   │  Machining Cost                               │
   │  = cycle_minutes × machine_₹/hr              │
   │  where cycle = rough + finish + features      │
   │    × tolerance_mult × roughness_mult          │
   │    + handling                                  │
   │                                               │
   │  + Surface finish + Inserts + Marking         │
   │  + Setup/Programming (÷ quantity)             │
   │  + Inspection + Certificates                  │
   │  × Margin %                                   │
   │  × Lead-time tier multiplier                  │
   │  = 3-tier price (Standard/Express/Rush)       │
   └─────────────────────────────────────────────┘
   Runs in browser (preview) + server (trusted)
```

---

## 3. Core Algorithm Deep-Dive — Smart Quote Engine

> [!IMPORTANT]
> This is the **main IP** of MECHmetrIQ. The algorithm lives in `src/lib/smartQuote/pricing.ts` and is a **pure function** — no side effects, fully deterministic given inputs.

### 3.1 Algorithm Inputs

| Input Source | Data | Origin |
|-------------|------|--------|
| **CAD Geometry** | `bbox_mm`, `volume_mm3`, `area_mm2`, `solid_count`, `rotational`, `turn_stock`, `features` | Render's `/analyze` endpoint (CadQuery/OpenCascade) |
| **Rate Card** | `milling_rate_per_hr`, `turning_rate_per_hr`, `setup_min`, `programming_min`, material removal rates, finishing rates | `sq_settings` table (admin-editable, id=1, JSONB) |
| **Material Rates** | `₹/kg` per grade, density (g/cm³) | `rm_rates` / `rm_grades` tables (Raw Material marketplace) |
| **Buyer Config** | quantity, finish, tolerance, roughness, threads, inserts, inspection, certificates, marking | User selections in the quote builder UI |

### 3.2 Pricing Model Breakdown

```
PER PART:
  ┌─ Material Cost ──────────────────────────────┐
  │  stock_dims = bbox + stock_allowance_mm       │
  │  stock_volume = (block or round bar)          │
  │  stock_weight = stock_volume × density        │
  │  material = stock_weight × ₹/kg × (1+scrap%) │
  └──────────────────────────────────────────────┘

  ┌─ Machining Cost ─────────────────────────────┐
  │  removed_vol = stock_volume - part_volume     │
  │  rough_min = removed_vol ÷ base_MRR           │
  │          × √(material_time_factor)            │
  │  finish_min = surface_area ÷ base_finish_rate │
  │          × √(material_time_factor)            │
  │                                                │
  │  feature_min = Σ per feature group:           │
  │    (firm_count × min_per_feature              │
  │     + candidate_count × min × candidate_wt)   │
  │    × √(material_time_factor)                  │
  │    capped at feature_cap_minutes              │
  │                                                │
  │  cycle = (rough + finish + features)          │
  │         × tolerance_multiplier                │
  │         × roughness_multiplier                │
  │         + handling_min_per_part                │
  │                                                │
  │  machining = cycle × machine_₹/hr ÷ 60       │
  └──────────────────────────────────────────────┘

  ┌─ Add-ons ────────────────────────────────────┐
  │  + threads × thread_min × ₹/hr               │
  │  + inserts × (insert_min × ₹/hr + cost_each) │
  │  + surface finish ₹/dm² × area               │
  │  + part marking fee                           │
  └──────────────────────────────────────────────┘

PER ORDER (spread over quantity):
  ┌──────────────────────────────────────────────┐
  │  setup_programming = (setups × setup_min     │
  │                      + programming_min)       │
  │                      × ₹/hr ÷ 60             │
  │  inspection_fee (per tier)                    │
  │  certificate_fee × count                     │
  │  finish_lot_charge (min lot if finishing)     │
  └──────────────────────────────────────────────┘

FINAL:
  subtotal = (per_part × qty + per_order)
  × (1 + margin_pct)
  × tier_multiplier (Standard 1.0 / Express ~1.3 / Rush ~1.6)
  = max(calculated, min_order_value)
  + GST (extra, not included)

OUTPUT: 3-tier TierPrice[] with unit_price, total, lead_days, arrives_by
```

### 3.3 Feature Detection Groups

The geometry parser classifies detected features into 10 groups, each with configurable pricing:

| Group | Examples | Pricing Lever |
|-------|----------|---------------|
| `hole` | Through holes, blind holes | Minutes per hole |
| `thread` | Internal/external threads | Minutes per thread |
| `pocket` | Open/closed pockets | Minutes per pocket |
| `slot` | T-slots, keyways | Minutes per slot |
| `boss` | Raised pads, standoffs | Minutes per boss |
| `edge` | Chamfers, fillets, countersinks | Minutes per edge op |
| `turning` | Turned features on rotational parts | Minutes per turning op |
| `thin` | Thin walls, ribs | Minutes per thin feature |
| `freeform` | Sculpted/freeform surfaces | Minutes per freeform |
| `cross` | Cross-holes, intersecting features | Minutes per cross feature |

Each detection is classified as **firm** (high confidence) or **candidate** (lower confidence, weighted down by `candidate_weight` ≈ 0.5).

### 3.4 Routing Decision: Milling vs Turning

```
if (geometry.rotational && geometry.turn_stock) {
    route = "turning"
    machine_rate = turning_rate_per_hr
    stock = round_bar(turn_stock.diameter, turn_stock.length)
} else {
    route = "milling"
    machine_rate = milling_rate_per_hr
    stock = block(bbox + allowance)
}
```

---

## 4. Critical Issues in Current Architecture

### 🔴 P0 — Showstoppers for Production

| # | Issue | Impact | Details |
|---|-------|--------|---------|
| 1 | **Single worker on Render Free tier** | CAD analysis is single-threaded, 512MB RAM, 0.1 CPU. Sleeps after 15 min → ~60s cold start. Cannot handle even 5 concurrent uploads. | Parser needs ~185MB per worker. Free tier = 1 worker max. |
| 2 | **Synchronous CAD analysis in HTTP request** | Vercel Server Actions have a 10s default timeout (60s max on Pro). Large STEP files can take 30-120s to parse. Users get timeouts. | `SERVICE_TIMEOUT_MS = 240_000` in code but Vercel will kill the function first. |
| 3 | **No encryption at rest for CAD files** | Supabase Storage uses S3 but default encryption; no customer-managed KMS keys. CAD files (proprietary IP) stored in shared infrastructure. | Files in `rfq-attachments` bucket are the crown jewels. |
| 4 | **CAD files transit unencrypted to Render** | STEP files sent as multipart POST over HTTPS (good) but Render free tier has no private networking. The API key (`X-API-Key`) is the only auth — a single static secret. | No mTLS, no VPC peering, no request signing. |
| 5 | **No observability** | Zero monitoring, no APM, no structured logging, no error tracking, no alerting. Production issues would be invisible. | No Datadog/NewRelic/Sentry/CloudWatch. |
| 6 | **No rate limiting or DDoS protection** | Vercel provides basic Edge protection but no application-level rate limiting. The Render endpoint is publicly accessible with just an API key. | Anyone with the key can flood the parser. |

### 🟠 P1 — Must Fix Before Scale

| # | Issue | Impact |
|---|-------|--------|
| 7 | **No database connection pooling** | Supabase free tier has 60 concurrent connections max. 1000 users = instant pool exhaustion. |
| 8 | **No CDN/edge caching strategy** | Thumbnails, static assets served from Vercel/Supabase without optimization. |
| 9 | **Single-region deployment** | All services in one region. No DR, no geo-distribution for Indian users. |
| 10 | **No staging/preview environments** | Merging to `main` deploys to production. No QA gate. |
| 11 | **Pricing algorithm exposed in browser bundle** | `estimatePart()` runs client-side for live preview. While server re-validates, the algorithm logic (your IP) ships to every browser. |
| 12 | **No audit trail for CAD file access** | No logging of who downloaded/viewed which CAD file when. Critical for NDA compliance. |

### 🟡 P2 — Important for Go-to-Market

| # | Issue | Impact |
|---|-------|--------|
| 13 | **No real payment gateway** | Simulated UPI/card. Need Razorpay/Cashfree integration. |
| 14 | **No email/notification system** | No transactional emails (quote ready, order status). |
| 15 | **No multi-tenancy isolation** | All buyers share the same storage bucket namespace. |
| 16 | **No automated DFM feedback** | Competitors provide Design for Manufacturability warnings — MECHmetrIQ doesn't. |

---

## 5. Competitor & Market Gap Analysis

### 5.1 Direct Competitor: MechHub.in

| Feature | MechHub | MECHmetrIQ (Baseline MVP) | MECHmetrIQ (Current State) | Gap & Strategic Moat |
|---------|---------|--------------------------|----------------------------|----------------------|
| **Instant quoting** | ✅ Yes (Form upload) | ✅ Yes (Smart Quote) | ✅ **Yes + Live "What-If" Sliders** | 🟢 **MECHmetrIQ Lead**: Real-time slider recalculation in <10ms without page reload. |
| **Interactive 3D CAD Viewer** | ❌ None (Upload & wait) | ❌ PNG thumbnail only | ✅ **Yes (Interactive 3D WebGL/Canvas)** | 🟢 **MECHmetrIQ Lead**: 60-120 FPS high-res supersampled viewer, feature map, wall thickness heatmap, cross-section cut. |
| **Generative AI CAD & Natural Language Editing** | ❌ None | ❌ None | ✅ **Yes (AI Live Machinist Chat)** | 🟢 **MECHmetrIQ Major Moat**: Live chat turns English to 3D B-Rep CAD, 1-click DFM auto-fix, revert/undo/redo. |
| **Parametric B-Rep & STEP AP242 Export** | ❌ Closed format | ❌ Download uploaded only | ✅ **Native ISO 10303 AP242 + CadQuery Script** | 🟢 **MECHmetrIQ Lead**: Direct open-kernel export with embedded GD&T / Ra metadata. |
| **Automated DFM Feedback** | 🟡 Basic checklist | ❌ Missing | ✅ **7-Layer Automated DFM + 1-Click Repair** | 🟢 **MECHmetrIQ Lead**: Identifies thin walls, tool aspect ratios, relief grooves, and offers 1-click automated geometry fixes. |
| **Raw Material Marketplace** | ❌ Closed vendor sourcing | 🟡 Via DB catalog | ✅ **Direct Cut-to-Size Marketplace + Calculator** | 🟢 **MECHmetrIQ Lead**: Live ₹/kg rates across 4 metal families, weight calculator, instant cut-to-size ordering. |
| **CAD file formats** | STEP, DXF, DWG | STEP only | STEP, STL, `.turncad` (Client parser + Server fallback) | 🟡 Parity on 3D; adding DXF/DWG for 2D sheet metal. |
| **Supported processes** | Laser/waterjet, CNC, bending, forming, anodizing, powder coating | CNC milling + turning only | CNC turning, milling, CAPP process planning, surface finish ($R_a$ 0.4–3.2 µm) | 🟡 Expanding sheet metal tooling. |
| **NDA & IP Protection** | ✅ Claimed "100% NDA" | ❌ No NDA workflow | 🟡 Client-side validation protects IP before upload | 🟠 Needs formal NDA click-wrap & KMS encryption. |
| **AES-256 encryption** | ✅ Claimed | ❌ Default S3 encryption | 🟡 Default storage | 🟠 Move to customer-managed KMS keys. |
| **Cost breakdown transparency** | ✅ "See every rupee" | ✅ Detailed breakdown | ✅ **Full transparency (Material + Setup + Machining + Margin)** | ✅ Parity |
| **Vendor network** | ✅ "MechMasters" | ✅ Vetted vendors | ✅ Dual-sided marketplace (Machinists + Material Stockists) | ✅ Parity |
| **Order tracking** | ✅ Real-time tracking | ❌ Not implemented | 🟡 Buyer dashboard quote stages | 🔴 Must add webhook delivery tracking. |

### 5.2 Global Competitors

| Platform | Key Differentiator | What MECHmetrIQ Brings (Our Advantage) |
|----------|-------------------|---------------------------------------|
| **Xometry** | AI-powered instant quoting, DFM feedback, global network | MECHmetrIQ adds **generative conversational CAD design** (chat to modify geometry, not just passive quoting). |
| **Protolabs** | In-house + network hybrid, automated DFM | MECHmetrIQ integrates an **open raw material marketplace** with live Indian commodity pricing. |
| **Partwork (India)** | Rapid CNC + 3D printing | MECHmetrIQ provides **transparent Sandvik/Kennametal algorithmic CAPP cost breakdown** instead of opaque black-box markups. |
| **MechHub (India)** | Sheet metal + CNC focus for student/SME prototyping | MECHmetrIQ provides **interactive in-browser 3D inspection, wall thickness heatmaps, and STEP AP242 export** that MechHub lacks entirely. |
| **Dashnode / Oroox** | White-label quoting SaaS | MECHmetrIQ can expose its pricing engine via embeddable headless API / widgets. |

### 5.3 Industry Standard Features (2026 Baseline vs. MECHmetrIQ)

| Industry Capability (2026 Table Stakes) | Industry Baseline | MECHmetrIQ Implementation Status |
|------------------------------------------|-------------------|-----------------------------------|
| **Instant CAD parsing & geometry analysis** | Server-side parsing (3–30s) | ✅ **Dual-mode**: Instant client-side parser (< 50ms) + Open CASCADE backend worker. |
| **Dynamic pricing by material/qty/finish** | Batch quote refresh | ✅ **Instant reactive recalculation** with What-If sliders. |
| **Multi-tier lead times** | Standard / Expedited | ✅ **3 Tiers** (Economy, Standard, Express) linked to CAPP cycle times. |
| **Automated DFM feedback** | Static PDF report | ✅ **Interactive 7-layer validation** with 1-click browser auto-fix. |
| **Interactive 3D Web Viewer** | Basic mesh viewer | ✅ **Super-sampled WebGL viewer** with Metallic, Feature Map, and Wall Thickness heatmaps. |
| **Generative CAD from Natural Language** | ❌ Absent in almost all competitors | ✅ **MECHmetrIQ AI Live Machinist Chat** (Profile-first B-Rep with revert & undo). |
| **Raw Material Direct Purchase** | ❌ Absent (Hidden in quote) | ✅ **Cut-to-size Raw Material Marketplace** with real-time ₹/kg rates. |
| **Multi-format support** | STEP, DXF, DWG, IGES | 🟡 STEP, STL, `.turncad` live; DXF/DWG parser in pipeline. |
| **Real-time order tracking & NDA** | Milestone tracking & NDAs | 🟡 Roadmap P1 implementation. |

---

## 5.4 Strategic Architecture: How MECHmetrIQ Out-Competes MechHub

MechHub operates primarily as a **passive broker portal**: users submit static CAD/DXF files, wait for an automated or manual quotation review, and receive an opaque price. If the part has a DFM issue (e.g. wall too thin, corner radius too sharp), the user must open their local desktop CAD software (SolidWorks/Fusion 360), manually edit the geometry, re-export, and re-upload.

MECHmetrIQ's **Code Architecture solves this friction loop directly**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                  THE TRADITIONAL BROKER FRICTION LOOP (MechHub, Xometry)                     │
│                                                                                              │
│   [Desktop CAD] ──> Export STEP ──> Upload to Portal ──> DFM Error Alert ──> [Reject/Stall]  │
│         ▲                                                                           │        │
│         └────────────── Must open desktop CAD, fix geometry, re-upload ─────────────┘        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                     MECHmetrIQ ZERO-FRICTION GENERATIVE LOOP                                 │
│                                                                                              │
│   [AI CAD Studio] ──> Live 3D Inspection ──> Automated DFM Alert ──> [1-Click Auto-Fix]      │
│         ▲                                                                      │             │
│         │                  Instant browser update (< 50ms)                     │             │
│         └──────────────────────────────────────────────────────────────────────┘             │
│                                                                                              │
│   * Result: Immediate checkout to RFQ cart or instant STEP AP242 download in 1 click.       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Moat Summary:
1. **Algorithmic Transparency (Kennametal/Sandvik CAPP)**: While competitors apply opaque black-box margins, MECHmetrIQ computes exact material removal rate ($MRR$), tool approach passes, setup scoring, and machine hour rates based on ISO standards.
2. **Hybrid Client/Cloud B-Rep Engine**: Instant client-side 60–120 FPS WebGL rendering with zero server lag, backed by a headless Open CASCADE (`build123d`/`CadQuery`) microservice for certified STEP AP242 downloads.
3. **Dual Marketplace Synergy**: Uniquely connects raw material stockists directly with precision machine shops on a single platform, optimizing stock allowance and bar cut-lengths.

---

## 6. Proposed Production Architecture

### 6.1 High-Level Architecture (AWS Primary, GCP Equivalent Noted)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                               USERS / BROWSERS                              │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │ HTTPS
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        AWS CloudFront CDN / WAF                              │
│                        (GCP: Cloud Armor + Cloud CDN)                        │
│                                                                              │
│  • DDoS protection (Shield Advanced)                                        │
│  • Web Application Firewall (rate limiting, geo-blocking, bot detection)    │
│  • Edge caching for static assets & thumbnails                              │
│  • TLS 1.3 termination                                                      │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                  APPLICATION LOAD BALANCER (ALB)                             │
│                  (GCP: Cloud Load Balancing)                                 │
│                                                                              │
│  Path-based routing:                                                        │
│    /api/upload/*  →  Upload Service                                         │
│    /api/quote/*   →  Quote Service                                          │
│    /api/auth/*    →  Auth Service                                           │
│    /*             →  Web Frontend (SSR)                                     │
└────────┬──────────┬──────────┬──────────┬───────────────────────────────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
┌────────────┐ ┌────────┐ ┌────────┐ ┌────────────────────┐
│  FRONTEND  │ │ AUTH   │ │ QUOTE  │ │  UPLOAD SERVICE    │
│  SERVICE   │ │SERVICE │ │SERVICE │ │                    │
│            │ │        │ │        │ │ Generates presigned│
│ Next.js    │ │Cognito │ │Express/│ │ S3 URLs for direct │
│ SSR in     │ │  or    │ │Fastify │ │ browser→S3 upload  │
│ ECS/Cloud  │ │Supabase│ │        │ │                    │
│ Run        │ │Auth    │ │pricing │ │ Validates file type│
│            │ │ + JWT  │ │engine  │ │ + size + virus scan│
│ Serves UI  │ │        │ │(server │ │                    │
│ only — NO  │ │MFA,    │ │ only)  │ │ Triggers async     │
│ pricing    │ │RBAC,   │ │        │ │ CAD analysis via   │
│ logic in   │ │session │ │Connects│ │ SQS/Pub-Sub        │
│ bundle     │ │mgmt    │ │to RDS  │ │                    │
└────────────┘ └────────┘ └────────┘ └─────────┬──────────┘
                                               │
                                     ┌─────────▼──────────┐
                                     │  S3 BUCKET (KMS)   │
                                     │  (GCP: GCS + CMEK) │
                                     │                    │
                                     │ • AES-256 with     │
                                     │   customer-managed │
                                     │   KMS keys         │
                                     │ • Bucket policy:   │
                                     │   no public access │
                                     │ • Object lock      │
                                     │ • Versioning       │
                                     │ • Lifecycle: auto  │
                                     │   delete after     │
                                     │   90 days          │
                                     │ • Access logging   │
                                     └─────────┬──────────┘
                                               │ S3 Event Notification
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     MESSAGE QUEUE (SQS / GCP Pub/Sub)                        │
│                                                                              │
│  • Buffers all CAD analysis requests                                        │
│  • Dead letter queue for failed jobs (3 retries)                            │
│  • Enables 1000 concurrent uploads without overwhelming workers             │
│  • Message deduplication (SHA-256 file hash)                                │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│              CAD ANALYSIS WORKER FLEET                                        │
│              ECS Fargate / GCP Cloud Run                                     │
│                                                                              │
│  ┌─────────────────────────────────────────────┐                            │
│  │  Container: mechmetriq-cad-worker           │                            │
│  │                                              │                            │
│  │  Python + CadQuery 2.8 (OpenCascade)        │                            │
│  │  + glTF export (for 3D web viewer)          │                            │
│  │  + DFM analysis module (NEW)                │                            │
│  │                                              │                            │
│  │  • Pulls STEP from S3 via presigned URL     │                            │
│  │  • Parses geometry → JSON                   │                            │
│  │  • Generates 3D glTF/GLB for web viewer     │                            │
│  │  • Runs DFM checks (thin walls, deep holes) │                            │
│  │  • Writes results to RDS + thumbnail to S3  │                            │
│  │  • Notifies frontend via WebSocket/SNS      │                            │
│  │                                              │                            │
│  │  Instance: c6i.xlarge (4 vCPU, 8GB RAM)     │                            │
│  │  Auto-scales 2-50 based on queue depth      │                            │
│  │  Spot instances for 70% cost savings        │                            │
│  └─────────────────────────────────────────────┘                            │
│                                                                              │
│  SCALING POLICY:                                                            │
│  • Min: 2 tasks (always warm, no cold starts)                               │
│  • Max: 50 tasks                                                            │
│  • Scale trigger: queue_messages ÷ running_tasks > 5                        │
│  • Scale-in cooldown: 5 min                                                 │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER                                        │
│                                                                              │
│  ┌──────────────────────┐    ┌──────────────────────┐                       │
│  │  RDS PostgreSQL      │    │  ElastiCache Redis    │                       │
│  │  (GCP: Cloud SQL)    │    │  (GCP: Memorystore)   │                       │
│  │                      │    │                        │                       │
│  │  • db.r6g.large      │    │  • Session cache       │                       │
│  │  • Multi-AZ          │    │  • Rate limiting       │                       │
│  │  • 1 read replica    │    │  • Pricing settings    │                       │
│  │  • PgBouncer pooling │    │    cache (sq_settings)  │                       │
│  │  • Encrypted at rest │    │  • File hash dedup     │                       │
│  │  • Point-in-time     │    │    cache               │                       │
│  │    recovery          │    │  • Quote result cache   │                       │
│  │  • RLS policies      │    │                        │                       │
│  │    preserved         │    │                        │                       │
│  └──────────────────────┘    └──────────────────────┘                       │
│                                                                              │
│  ┌──────────────────────┐                                                   │
│  │  DynamoDB / Firestore│  ← Job status tracking (high write throughput)    │
│  │  (for job states)    │    PENDING → PROCESSING → COMPLETED → FAILED     │
│  └──────────────────────┘                                                   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                     REAL-TIME NOTIFICATIONS                                   │
│                                                                              │
│  AWS AppSync (WebSocket/GraphQL)  or  API Gateway WebSocket                 │
│  (GCP: Firebase Realtime Database / Cloud Pub/Sub)                          │
│                                                                              │
│  • "Your CAD file is being analyzed..."                                     │
│  • "Quote ready! 3 pricing tiers available"                                 │
│  • "Order status: Manufacturing in progress"                                │
│  • "DFM Warning: 2 issues detected in your design"                         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                     OBSERVABILITY STACK                                       │
│                                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │CloudWatch  │  │ X-Ray /    │  │ Sentry     │  │ CloudTrail │            │
│  │ Logs +     │  │ Datadog APM│  │ Error      │  │ + S3 Access│            │
│  │ Metrics    │  │            │  │ Tracking   │  │   Logs     │            │
│  │            │  │ Distributed│  │            │  │            │            │
│  │ Custom     │  │ tracing    │  │ Frontend + │  │ Audit trail│            │
│  │ dashboards │  │ across all │  │ Backend    │  │ for every  │            │
│  │            │  │ services   │  │ errors     │  │ file access│            │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Decompose monolith into 4 services** | Frontend, Auth, Quote, Upload — each scales independently. The CAD worker fleet is the bottleneck; it must scale separately. |
| **Async CAD processing via queue** | Never process CAD files inside an HTTP request. Return `202 Accepted` + `job_id` immediately. Users get real-time updates via WebSocket. |
| **Presigned URL upload (browser → S3 directly)** | CAD files never transit through the application server. Reduces latency, bandwidth costs, and attack surface. |
| **File hash deduplication** | SHA-256 hash before processing. If the same file was analyzed before → return cached results instantly. Saves ~40% compute. |
| **Pricing engine stays server-side ONLY** | Remove `estimatePart()` from the browser bundle. Send a lightweight "price preview" API that returns numbers without exposing the algorithm. |
| **Redis cache for rate cards** | `sq_settings` and `rm_rates` are read thousands of times per second but written once a day. Cache them. TTL: 5 min with invalidation on admin update. |
| **Spot/Preemptible instances for workers** | CAD analysis is fault-tolerant (queue retries). Spot saves 70% on compute. |

### 6.3 Service Breakdown

#### Service 1: Web Frontend (Next.js SSR)
```
Container: ECS Fargate / Cloud Run
Scaling: 2-20 instances based on request count
Role: Serves the UI (buyer/vendor/admin routes)
DOES NOT contain: pricing algorithm, CAD processing
Connects to: Quote Service API, Auth Service, S3 (presigned URLs)
```

#### Service 2: Quote Service (Node.js / TypeScript)
```
Container: ECS Fargate / Cloud Run
Scaling: 2-10 instances
Role: 
  - Hosts estimatePart() — the pricing algorithm (NEVER in browser)
  - Reads geometry from DB
  - Reads rate cards from Redis cache
  - Returns 3-tier pricing
  - Serves "live preview" API for the quote builder
Connects to: RDS PostgreSQL, ElastiCache Redis
```

#### Service 3: Upload & Analysis Orchestrator
```
Container: ECS Fargate / Cloud Run
Scaling: 2-10 instances
Role:
  - Generates presigned S3 upload URLs
  - Validates uploads (file type, size, virus scan via ClamAV)
  - Publishes analysis jobs to SQS
  - Handles WebSocket connections for progress updates
Connects to: S3, SQS, WebSocket API
```

#### Service 4: CAD Analysis Worker Fleet
```
Container: ECS Fargate (Spot) / Cloud Run
Scaling: 2-50 instances based on queue depth
Role:
  - Polls SQS for analysis jobs
  - Downloads STEP from S3 (presigned URL, time-limited)
  - Runs CadQuery/OpenCascade geometry analysis
  - Runs DFM checks (NEW)
  - Generates glTF/GLB for 3D web viewer (NEW)
  - Writes results to RDS + S3
  - Publishes completion notification via SNS
Instance: c6i.xlarge (4 vCPU, 8GB) — compute-optimized for geometry parsing
```

---

## 7. Security Architecture — CAD IP Protection

> [!CAUTION]
> CAD files contain proprietary product designs (potential future patents). A breach could cost clients millions. This section is **non-negotiable** for production.

### 7.1 Defense-in-Depth Layers

```
Layer 1: NETWORK
  ├── CloudFront WAF (DDoS, bot, rate limit)
  ├── VPC with private subnets for all services
  ├── No public endpoints for DB, cache, workers
  ├── VPC endpoints for S3 (traffic never leaves AWS network)
  └── Security groups: least-privilege per service

Layer 2: IDENTITY & ACCESS
  ├── Cognito / Supabase Auth with MFA (mandatory for enterprise accounts)
  ├── JWT with short expiry (15 min access + refresh token rotation)
  ├── RBAC: buyer / vendor / admin with DB-level RLS
  ├── API key rotation for service-to-service auth (no static keys)
  └── OAuth2 / SAML SSO for enterprise buyers

Layer 3: DATA PROTECTION
  ├── S3: AES-256 encryption with AWS KMS (customer-managed keys)
  ├── S3: Bucket policy — no public access, VPC endpoint only
  ├── S3: Object Lock (WORM) for audit compliance
  ├── S3: Presigned URLs with 15-min expiry for upload/download
  ├── S3: Server access logging → CloudTrail
  ├── RDS: Encrypted at rest (KMS) + in transit (SSL enforced)
  ├── Redis: In-transit encryption + AUTH
  └── Secrets Manager for all credentials (zero hardcoded secrets)

Layer 4: APPLICATION
  ├── File validation: type check (magic bytes, not extension), size limit, ClamAV scan
  ├── Dynamic watermarking on CAD thumbnails (user ID + timestamp)
  ├── No CAD file download by vendors — server-side 3D viewer only
  ├── Automatic file expiry: CAD files deleted after 90 days
  ├── Pricing algorithm NEVER in browser bundle
  └── Content Security Policy, CORS, rate limiting per user

Layer 5: AUDIT & COMPLIANCE
  ├── CloudTrail: every S3 object access logged (API calls & data events)
  ├── Application audit log: who viewed/quoted which CAD file, when, from where
  ├── NDA acceptance flow: digital signature before file access (Information Technology Act, 2000 compliant)
  ├── SOC 2 Type II readiness (AICPA Trust Services Criteria: Security, Confidentiality)
  ├── ISO/IEC 27001:2022 alignment (Information Security Management)
  ├── NIST SP 800-53 Rev. 5 controls baseline (Access Control, Media Protection)
  └── GDPR (EU 2016/679) & Digital Personal Data Protection Act, 2023 (DPDP Act 2023) compliance for PII
```

### 7.2 CAD File Lifecycle Security

```
UPLOAD                          STORAGE                         ACCESS
───────                         ─────────                       ──────
Browser generates               S3 bucket:                     Presigned URL:
presigned URL                   • Private, no public access    • 15 min expiry
(15 min expiry)                 • AES-256 + KMS CMK           • Scoped to single
       │                        • Object Lock                     object
       ▼                        • Versioning enabled           • Logged in CloudTrail
Direct upload to S3             • Lifecycle: 90-day delete            │
(never touches app server)      • VPC endpoint access only            ▼
       │                               │                       CAD worker downloads
       ▼                               │                       via presigned URL
ClamAV virus scan               Access logged:                 inside VPC
(Lambda trigger)                • CloudTrail for S3            Processes in-memory
       │                        • App audit log for user       Deletes local copy
       ▼                          actions                      immediately after
Metadata → RDS                  • Watermarked thumbnails
SHA-256 hash computed           
```

### 7.3 NDA Workflow (New Feature)

```
1. Buyer uploads CAD file
2. System records SHA-256 hash + metadata
3. Before any vendor can VIEW the design:
   a. System generates NDA document (template + project details)
   b. Vendor must digitally sign NDA (eSign integration)
   c. NDA stored with timestamp, IP address, device fingerprint
   d. Only then: vendor gets time-limited 3D viewer access
4. Vendor sees server-rendered 3D viewer (no file download ever)
5. All access logged with watermarked screenshots
6. NDA auto-expires with project; can be extended
```

---

## 8. Differentiators — What Doesn't Exist in the Market

> [!TIP]
> These features would give MECHmetrIQ a **unique competitive edge** that no current Indian platform offers.

### 8.1 🆕 AI-Powered DFM (Design for Manufacturability) Feedback

**What it is:** Automatically analyze uploaded CAD files and flag manufacturing risks BEFORE quoting.

**What no one does well in India:** MechHub, Partwork, and most Indian platforms offer zero DFM feedback. Xometry does it globally but not with India-specific manufacturing constraints.

```
Example DFM Report:
┌─────────────────────────────────────────────────────┐
│  ⚠️  DFM ANALYSIS — 3 Issues Found                 │
│                                                      │
│  🔴 CRITICAL: Wall thickness 0.3mm at Feature #7    │
│     → Minimum recommended: 0.8mm for Aluminum 6061  │
│     → Risk: Part will warp during machining          │
│                                                      │
│  🟡 WARNING: Hole depth/diameter ratio = 12:1       │
│     → Maximum recommended: 10:1 for standard drills │
│     → Suggestion: Use EDM or split into 2 operations│
│                                                      │
│  🟡 WARNING: Internal corner radius < 1mm           │
│     → Standard end mill minimum: 1.5mm radius       │
│     → Will require EDM or special tooling (+15% cost)│
│                                                      │
│  💡 OPTIMIZATION: Reducing tolerance from ±0.01 to  │
│     ±0.05 on non-critical surfaces saves ~22% cost  │
└─────────────────────────────────────────────────────┘
```

**Implementation:** Rules engine on the geometry output from CadQuery. Check wall thickness, hole depth ratios, internal corner radii, overhang angles, thread depth, undercuts. Later: ML model trained on past manufacturing defects.

### 8.2 🆕 Interactive 3D Web Viewer with Annotation

**What it is:** Browser-based 3D model viewer (three.js / model-viewer) where buyers and vendors can rotate, measure, annotate, and discuss the design — without downloading the file.

**Why it's a differentiator:** 
- MechHub only shows static images
- No Indian platform has collaborative 3D annotation
- Eliminates the need to share native CAD files with vendors (massive security win)

```
Features:
• Rotate, zoom, pan the 3D model
• Click-to-measure dimensions
• Add annotation pins with comments
• Section view / exploded view
• Color-code features by manufacturing process
• Shareable link (time-limited, NDA-gated)
```

### 8.3 🆕 Multi-Process Quoting Engine

**What it is:** Extend beyond CNC milling/turning to support:
- Sheet metal (laser/waterjet cutting + bending)
- 3D printing (FDM, SLA, SLS)
- Injection molding (basic tooling cost estimation)
- Surface treatments (anodizing, powder coating, plating)

**Why it matters:** MechHub supports 9 processes but doesn't offer instant quoting for all of them. Being the first platform to offer **true instant quoting across all processes** is a massive differentiator.

### 8.4 🆕 "What-If" Pricing Simulator

**What it is:** After uploading a CAD file, buyers can run side-by-side comparisons:

```
┌──────────────────┬──────────────────┬──────────────────┐
│   Option A       │   Option B       │   Option C       │
│                  │                  │                  │
│ Al 6061-T6       │ SS 304           │ Al 7075-T6       │
│ ±0.05 tolerance  │ ±0.05 tolerance  │ ±0.01 tolerance  │
│ Bead blast       │ Passivation      │ Anodized (black) │
│ Qty: 10          │ Qty: 10          │ Qty: 10          │
│                  │                  │                  │
│ ₹1,240/part      │ ₹2,890/part      │ ₹1,950/part      │
│ 7 days           │ 7 days           │ 10 days          │
│                  │                  │                  │
│ DFM: ✅ 0 issues │ DFM: ✅ 0 issues │ DFM: ⚠️ 1 warn  │
└──────────────────┴──────────────────┴──────────────────┘
```

**No one does this.** Every platform makes you re-configure and re-quote one option at a time.

### 8.5 🆕 Blockchain-Anchored IP Proof

**What it is:** When a CAD file is uploaded, compute its SHA-256 hash and anchor it to a public blockchain (or Ethereum L2 / Polygon). This creates an immutable, timestamped proof that the client owned this design at this point in time.

**Why it matters:** If a vendor leaks the design, the client has cryptographic proof of prior art. No manufacturing platform offers this. It's a powerful trust signal for IP-conscious clients.

### 8.6 🆕 Vendor Capacity & Load Balancing

**What it is:** Real-time dashboard showing vendor machine utilization. Auto-route orders to vendors with available capacity for fastest delivery.

```
Vendor A (CNC 5-axis): 85% utilized → 10 day lead time
Vendor B (CNC 3-axis): 40% utilized → 5 day lead time  ← AUTO-SELECTED
Vendor C (CNC 5-axis): 60% utilized → 7 day lead time
```

### 8.7 🆕 Parametric Quote API for Enterprise

**What it is:** REST/GraphQL API that enterprise customers can call programmatically from their PLM/ERP systems to get instant quotes without using the web UI.

```bash
POST /api/v1/quote
{
  "file_url": "s3://...",
  "material": "AL6061-T6",
  "quantity": 100,
  "tolerance": "±0.05",
  "finish": "anodized_black"
}

Response:
{
  "tiers": [
    { "label": "Standard", "unit_price": 1240, "lead_days": 10 },
    { "label": "Express", "unit_price": 1612, "lead_days": 5 },
    { "label": "Rush", "unit_price": 1984, "lead_days": 3 }
  ],
  "dfm_warnings": [...],
  "viewer_url": "https://..."
}
```

---

## 9. Migration Roadmap

### Phase 1: Foundation (Weeks 1-4) — "Make It Not Break"

| Task | Priority | Effort |
|------|----------|--------|
| Set up AWS account with VPC, subnets, security groups | P0 | 3 days |
| Migrate Supabase Postgres → RDS PostgreSQL (preserve RLS) | P0 | 5 days |
| Migrate Supabase Storage → S3 with KMS encryption | P0 | 3 days |
| Containerize Next.js app → ECS Fargate | P0 | 3 days |
| Containerize CAD worker → ECS Fargate (Spot) | P0 | 3 days |
| Set up SQS queue for async CAD processing | P0 | 2 days |
| Set up ALB + CloudFront + WAF | P0 | 2 days |
| Set up ElastiCache Redis for caching | P1 | 2 days |
| Set up CloudWatch logging + basic alarms | P0 | 2 days |
| CI/CD pipeline (GitHub Actions → ECR → ECS) | P1 | 3 days |

### Phase 2: Security & Scale (Weeks 5-8) — "Make It Safe"

| Task | Priority | Effort |
|------|----------|--------|
| Presigned URL upload flow (browser → S3 direct) | P0 | 3 days |
| Remove pricing algorithm from browser bundle | P0 | 2 days |
| Add ClamAV virus scanning on upload | P1 | 2 days |
| Implement NDA workflow + digital signature | P1 | 5 days |
| Add audit logging for all CAD file access | P0 | 3 days |
| Implement rate limiting (per-user, per-IP) | P1 | 2 days |
| Add WebSocket real-time notifications | P1 | 4 days |
| Set up staging environment | P1 | 2 days |
| Load testing (target: 1000 concurrent users) | P0 | 3 days |
| Integrate Razorpay payment gateway | P1 | 5 days |

### Phase 3: Differentiate (Weeks 9-16) — "Make It Special"

| Task | Priority | Effort |
|------|----------|--------|
| DFM analysis module (rules engine) | P1 | 10 days |
| 3D web viewer (three.js + glTF export) | P1 | 10 days |
| "What-If" pricing simulator | P2 | 5 days |
| DXF/DWG file format support | P1 | 7 days |
| Sheet metal quoting engine | P1 | 10 days |
| Real-time order tracking | P1 | 7 days |
| Transactional email system (SES) | P2 | 3 days |
| Enterprise Quote API (REST) | P2 | 5 days |
| Blockchain IP anchoring | P3 | 5 days |

---

## 10. Cost Estimation

### Monthly AWS Cost for 1000 Concurrent Users

| Service | Specification | Monthly Cost (USD) |
|---------|--------------|-------------------|
| **ECS Fargate (Frontend)** | 4 tasks × 1 vCPU × 2GB × 730 hrs | ~$120 |
| **ECS Fargate (Quote Service)** | 2 tasks × 0.5 vCPU × 1GB | ~$30 |
| **ECS Fargate (Upload Service)** | 2 tasks × 0.5 vCPU × 1GB | ~$30 |
| **ECS Fargate Spot (CAD Workers)** | Avg 5 tasks × 4 vCPU × 8GB (Spot: 70% off) | ~$180 |
| **RDS PostgreSQL** | db.r6g.large, Multi-AZ + 1 read replica | ~$350 |
| **ElastiCache Redis** | cache.r6g.large | ~$120 |
| **S3 Storage** | 500GB + requests + data transfer | ~$50 |
| **CloudFront CDN** | 1TB transfer/month | ~$85 |
| **ALB** | Application Load Balancer | ~$25 |
| **WAF** | Web ACL + rules | ~$30 |
| **SQS** | ~500K messages/month | ~$5 |
| **CloudWatch** | Logs + metrics + alarms | ~$50 |
| **Secrets Manager** | 10 secrets | ~$5 |
| **KMS** | 2 keys + API calls | ~$10 |
| **NAT Gateway** | 2 AZ | ~$70 |
| **Data Transfer** | Outbound | ~$50 |
| | | |
| **TOTAL** | | **~$1,210/month** |

> [!NOTE]
> This is approximately **₹1,00,000/month** (at ₹83/USD). Compared to the current $0/month (free tiers), this is the cost of being production-ready. For context, a single enterprise client's first order could cover 6+ months of infrastructure.

### Cost Optimization Levers

- **Spot instances** for CAD workers: already saving ~70%
- **Reserved Instances** for RDS/Redis: save additional 30-40% with 1-year commitment
- **SHA-256 deduplication cache**: skip re-analysis of identical files (~40% compute savings)
- **Right-sizing**: start with smaller instances, scale up based on actual load data
- **S3 lifecycle policies**: auto-tier to Glacier after 90 days

---

## Summary — Current vs Proposed

| Dimension | Current (Vibe-Coded MVP) | Proposed (Production) |
|-----------|-------------------------|----------------------|
| **Hosting** | Vercel free + Render free | AWS ECS Fargate (multi-AZ) |
| **CAD Processing** | 1 worker, sleeps, 60s cold start, sync | 2-50 auto-scaled workers, async via queue |
| **File Storage** | Supabase Storage (shared S3) | S3 with KMS CMK, VPC endpoint, audit logging |
| **Database** | Supabase free Postgres (60 conn limit) | RDS Multi-AZ + read replica + PgBouncer |
| **Caching** | None | ElastiCache Redis (rate cards, sessions, dedup) |
| **Security** | Basic HTTPS + RLS + single API key | WAF + KMS + presigned URLs + NDA + audit trail |
| **Observability** | Console.log | CloudWatch + X-Ray + Sentry + CloudTrail |
| **Pricing Algorithm** | In browser bundle (exposed) | Server-side only, API returns numbers only |
| **File Upload** | Via Vercel → Supabase Storage | Browser → S3 direct (presigned URL) |
| **DFM Feedback** | ❌ None | ✅ Automated rules engine |
| **3D Viewer** | PNG thumbnail only | Interactive three.js viewer with annotations |
| **File Formats** | STEP only | STEP + DXF + DWG + IGES |
| **Processes** | CNC mill + turn | CNC + sheet metal + 3D print + injection molding |
| **Payments** | Simulated | Razorpay integration |
| **Concurrent Users** | ~5 max | 1000+ tested |
| **Monthly Cost** | $0 | ~$1,210 (~₹1 lakh) |

---

> [!IMPORTANT]
> **Bottom line:** The core pricing algorithm (`estimatePart()`) is genuinely well-engineered and is the real IP of this project. The architecture around it, however, was built for a demo — not for production. This plan preserves and protects the algorithm while wrapping it in an infrastructure that can handle real-world scale, security requirements, and competitive differentiation.
