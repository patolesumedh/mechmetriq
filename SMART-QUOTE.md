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

## Instant estimate on upload (v1.1)

**Get Instant Quote** now works like an instant-quote marketplace:

1. The buyer drops STEP files. Each one uploads straight to Storage and is sent
   to the parser right away (`startPartAnalysisAction`); the page polls until
   it's read (~10–40 s; up to ~2 min if Render was asleep).
2. A part card appears: shaded thumbnail (rendered by the parser), size and
   volume, turned or milled, detected features, configuration (material from
   the raw-material grade list, finish, tolerance, more options), quantity.
3. Three price cards (Least expensive / Standard / Fastest) update live as the
   buyer changes anything. Other file types (IGES, DWG, PDF…) become
   "priced by our team" cards.
4. **Request quote** creates one RFQ per part. The server recomputes the
   estimate (the browser's numbers are never trusted) and stores it with
   `price_status = 'estimated'`.
5. Admin → Quotes & RFQs → open the RFQ: full cost breakdown and a **Confirm
   price** form. The buyer then sees "Price confirmed" on My Quotes.

**Pricing** (`src/lib/smartQuote/pricing.ts`): material (stock weight ×
rate-card ₹/kg × scrap) + machining (rough + finish passes + capped feature
minutes, × tolerance/roughness, × machine ₹/hr) + finish/inserts/marking per
part; setup + programming, inspection, certificates per order; then margin,
tier multiplier and minimum order value. Every number lives in `sq_settings`
and is editable at **Admin → Smart Quote rates**. The defaults are starting
points — calibrate them against a few past jobs.

**Security:** a trigger (`rfqs_guard_price_fields`) blocks buyers from setting
or changing any price field, quantity or material once an estimate exists;
only the server (service role) and admins can. Migrations `0011`, `0012` are
applied to production.

## Deploy — in this order

1. **Generate a shared key** (any 64-char random string), e.g. `openssl rand -hex 32`.
2. **Deploy the parser.** Render → New → Blueprint → pick this repo (reads
   `render.yaml`). Set `SMARTQUOTE_API_KEY` to the key. Wait for
   `https://<your-service>.onrender.com/health` to show `{"ok":true}`.
   `render.yaml` uses the **Free** plan (one worker, sleeps after 15 min idle,
   first analysis then waits ~1–2 min). For real traffic switch to Standard.
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
