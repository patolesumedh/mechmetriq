# Smart Quote v1 — STEP File Analysis & Server-Side Pricing (Blueprint v3.1.0)

Buyers attach STEP files (`.step` / `.stp`) and drawings (`.pdf`, `.dwg`, `.dxf`, `.iges`, `.stl`, `.png`, `.jpg`) on **Get Instant Quote** (`/buyer/quote`). Each STEP file is automatically analysed for bounding box, volume, surface area, holes, pockets, slots, chamfers, turning features, stock size, and machining operations.

## Production Architecture (Cloud Run + Private GCS + Pub/Sub + HMAC Callback)

```text
Buyer's browser
  ├── 1. SHA-256 hash (WebCrypto) + requestCadUploadUrlAction()
  │      (Upstash rate-limited: 30/hr user, 60/hr IP; server-chosen path uploads/{uid}/{uuid}.ext)
  ├── 2. Direct PUT to Private GCS (gs://mechonehub-<env>-cad-files)
  │      (15-min V4 Signed URL, locked Content-Type & x-goog-content-length-range: 1..50 MB)
  └── 3. startPartAnalysisAction()
         ├── SHA-256 dedup check (reuses verified completed result for same buyer if identical)
         └── Publishes job to GCP Pub/Sub topic `cad-analysis-jobs`
                │
                ▼ Authenticated Push (OIDC token as pubsub-invoker@, max 5 retries -> dead-letter)
         Cloud Run: `mechonehub-cad-worker` (Python 3.11 + CadQuery, concurrency 1, max 5 instances)
         [ZERO database credentials — reads `uploads/`, writes thumbnail ONLY to `derived/{id}.png`]
                │
                ▼ HMAC-SHA256 signed POST (`x-cad-timestamp`, `x-cad-signature` with CAD_CALLBACK_SECRET)
         Cloud Run: `mechonehub-web` -> `POST /api/internal/cad-result`
         [Verifies ±300s timestamp + constant-time HMAC + Zod schema, idempotently updates `cad_analyses`]
```

### Dual-Mode Local Development Fallback
When `GCS_CAD_BUCKET` and `PUBSUB_CAD_TOPIC` are not set in `.env.local`, the app automatically falls back to uploading to Supabase Storage (`rfq-attachments`) and calling `SMARTQUOTE_API_URL/analyze` directly. Vendor KYC documents **always** stay in Supabase Storage (`KYC_DOCS_BUCKET`) under RLS.

## Server-Only Pricing Protection

- **`src/lib/smartQuote/pricing.ts`** is marked `import "server-only"` so `estimatePart()` and proprietary rate multipliers from `sq_settings` are never bundled into browser JavaScript.
- Client components import currency formatting and display types from **`src/lib/smartQuote/pricingFormat.ts`** and request live tier previews from **`POST /api/preview-price`** (validated with `zod`, rate-limited to 60 req/min/IP via Upstash Redis, and backed by 10-minute Upstash caching of `rm_rates` and `sq_settings`).
- When a buyer submits an RFQ (`submitQuoteAction`), the server recomputes the estimate authoritatively.
- When an order is paid (`payQuoteAction`), CAD files in `uploads/` are copied to `orders/{orderId}/` so the 90-day GCS lifecycle rule on `uploads/` and `derived/` preserves active order files.

*(Note: `render.yaml` is retained temporarily during the Phase 5 cutover and will be removed once `mechonehub-cad-worker` is verified in production on Cloud Run.)*
