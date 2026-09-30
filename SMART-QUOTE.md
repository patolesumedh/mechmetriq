# Smart Quote v1 — STEP file reading

Buyers attach STEP files on **Get Instant Quote** as before. Each `.step` /
`.stp` file is now read automatically: size, volume, surface area, holes,
pockets, slots, chamfers, turning features, a round-bar stock estimate and an
operation plan. Results show on **My Quotes** (and a full report page), and on
**Admin → Quotes & RFQs** (with Re-run).

Drawings (PDF/DWG/images) are still stored for the team; v1 doesn't read them.

## How it fits together

```
Buyer's browser ──upload──▶ Supabase Storage (rfq-attachments, private)
      │
      └─ submit form ─▶ Vercel server action ─ saves RFQ + cad_analyses row (pending)
                              │ after the response is sent (next/server `after`)
                              ▼
                      Parser service (Docker: services/smartquote)
                              │ JSON
                              ▼
                      cad_analyses.result / summary  ──▶ My Quotes, admin
```

The parser needs OpenCascade (hundreds of MB of native libraries), so it
can't run on Vercel. It runs as its own small container.

## What changed

| Area | Change |
|---|---|
| `services/smartquote/` | The v1 algorithm as a web API (FastAPI + Docker). See its README. |
| `supabase/migrations/0010_cad_analyses.sql` | New table. Buyers read their own rows, admins read all, **nobody writes except the server** (service-role key). **Already applied** to Supabase `mechmetriq`; RLS tested. |
| `src/app/buyer/quote/*` | Files now upload from the browser straight to Storage. Before, they went through the server action, which rejects anything over **1 MB** — so most real CAD files were failing. STEP files get an "Auto-analysed" tag. |
| `src/app/buyer/quotes/*` | "Part analysis" block per RFQ, live-updating; full report at `/buyer/quotes/analysis/[id]`. |
| `src/app/admin/quotes/*` | "CAD analysis" column; "Analyse N STEP files" for RFQs from before v1; report + Re-run at `/admin/quotes/analysis/[id]`. |
| `src/lib/smartQuote/`, `src/components/smartQuote/`, `src/lib/supabase/admin.ts` | Service call, result types, report UI, server-only service-role client. |

## Deploy — in this order

1. **Generate a shared key** (any 64-char random string), e.g. `openssl rand -hex 32`.
2. **Deploy the parser.** Render → New → Blueprint → pick this repo (reads
   `render.yaml`). Set `SMARTQUOTE_API_KEY` to the key. Wait for
   `https://<your-service>.onrender.com/health` to show `{"ok":true}`.
   (Standard plan, 2 GB. The parser needs ~450 MB per file, so the 512 MB
   Free/Starter plans run out of memory.)
3. **Vercel → Settings → Environment Variables** (Production + Preview):
   - `SMARTQUOTE_API_URL` = `https://<your-service>.onrender.com`
   - `SMARTQUOTE_API_KEY` = the same key
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase → Project Settings → API keys →
     `service_role` (secret). Server-only; never prefix it with `NEXT_PUBLIC_`.
4. Upload the changed files on a branch, open the PR, test on the preview URL:
   submit a quote with a STEP file → My Quotes shows "Queued" → "Analysed"
   within a few seconds (≈1 min if the service was asleep) → View report.
5. Merge. Then in Admin → Quotes & RFQs, use "Analyse STEP files" on the two
   existing RFQs if they have STEP attachments.

If the env vars are missing the site still works and RFQs save normally.
Without `SUPABASE_SERVICE_ROLE_KEY` no analysis is created; with it but without
the two `SMARTQUOTE_*` values, analyses show "Couldn't read — the analysis
service isn't configured yet" and can be re-run from admin once it is.
