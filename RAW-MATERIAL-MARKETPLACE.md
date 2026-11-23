# Raw Material Marketplace — release notes & deployment

Branch: `raw-material-marketplace`

A MetaleMart-style catalogue built into MECHmetrIQ, run on the **platform-priced,
contracted-vendor model**: MECHmetrIQ keeps one ₹/kg rate card, buyers order from
it, and an admin assigns every order to a verified raw-material vendor.

## What's in it

| Area | Route | What it does |
|---|---|---|
| Catalogue (public) | `/raw-materials` | 17 shapes × 12 materials × 87 grades; quick finder; filter by material |
| | `/raw-materials/[shape]` | Materials offered in that shape, "from ₹/kg" |
| | `/raw-materials/[shape]/[material]` | Grade table: equivalents, uses, density, rate |
| | `/raw-materials/[shape]/[material]/[grade]` | Grade facts (HSN, GST, density, MTC) + **configurator**: dimensions, length, qty, MTC → live weight and price |
| | `/raw-materials/weight-calculator` | Standalone weight calculator (same formulas and densities) |
| Buyer | `/buyer/cart` | Priced cart (bulk discount, cutting, MTC, GST), address, billing GSTIN → **place order** |
| | `/buyer/orders/[id]` | Progress (placed → approved → paid → dispatched → delivered), pay after approval, cancel before payment |
| | `/buyer/orders/[id]/proforma` | Printable proforma invoice (Print / Save as PDF) |
| Admin | `/admin/raw-materials` | Approval queue · **rate card** (₹/kg per grade, change log) · charges, bulk tiers, shape premiums |
| | `/admin/orders/[id]` | For RM orders: assign supplier (vendors who declared supply are listed first), set freight, approve or reject |
| Vendor (raw material) | `/vendor/raw_material/supply` | "What I Supply": shapes × grades, dispatch pincode, MTC / cut-to-size |

### Wrong-data fix (from the MetaleMart review)
MetaleMart lists aluminium grades (2024, 6061, 7075…) under "Stainless Steel" round bars.
Here every grade belongs to exactly one material by foreign key, grades can be limited
to the shapes they are really made in, and the database refuses to price a line whose
grade doesn't belong to the material or shape. `/raw-materials/round-bar/stainless-steel/al-6061`
returns 404. Combined or vague names were also cleaned up (e.g. "EN8 (C45)" split into
EN8 and C45; "CuZn30 / CuZn40" split; "Commercial MS" and "Low grade copper 92%" dropped),
and each grade carries its own density so weights are right per alloy.

### Pricing rules (all computed in the database)
- Line price = theoretical weight × rate. Rate = grade base rate × (1 + shape premium), or a shape-specific override.
- Cutting on non-stock lengths / sheet sizes = max(pieces × ₹/cut, kg × ₹/kg).
- MTC = flat fee per line. Bulk discount by total order weight (tiers in admin).
- GST per line at the material's rate; GST on freight at the configured rate.
- The cart stores dimensions only; `rm_place_order` re-prices everything, so buyers
  cannot submit their own prices. Raw-material orders and lines can't be edited
  directly through the API (guard triggers); vendors can only advance fulfilment status.

## Deploy

### 1. Put the code on the branch
Either:
- **Git (exact copy, includes deletions):** `git fetch <path>/raw-material-marketplace.bundle raw-material-marketplace:raw-material-marketplace && git push origin raw-material-marketplace`
- **Patch:** `git checkout -b raw-material-marketplace && git am raw-material-marketplace.patch && git push -u origin raw-material-marketplace`
- **GitHub web upload:** create branch `raw-material-marketplace` from `main`, upload the
  contents of `changed-files/` (keeps folder paths), then **delete the folder
  `src/app/buyer/marketplace/[id]/`** (the old vendor-listing "Buy Now" page).

### 2. Apply the database migrations (Supabase project `mechmetriq`)
Run in order in the SQL editor (or `supabase db push`):
1. `supabase/migrations/0008_raw_material_marketplace.sql` — tables, pricing functions, RLS, guards
2. `supabase/migrations/0009_raw_material_catalog_seed.sql` — catalogue + **indicative** rates

Both are additive. The only change to existing objects: `orders.vendor_id` becomes nullable
and new nullable `rm_*` columns are added. After applying, the old "Buy Now" on vendor
listings can no longer create raw-material orders (there are no listings in production).
The Vercel preview shares the production database, so apply these before testing the preview.

### 3. Environment variables (optional, Vercel → Production + Preview)
| Name | Used for |
|---|---|
| `RM_SELLER_LEGAL_NAME` | Seller name on proformas (default "MECHmetrIQ") |
| `RM_SELLER_GSTIN` | Seller GSTIN on proformas |
| `RM_SELLER_ADDRESS` | Seller address on proformas |
| `RM_SELLER_EMAIL` | Contact on proformas (default hello@mechmetriq.com) |

### 4. Smoke test on the preview
1. Signed out: `/raw-materials` → Round Bar → Stainless Steel → SS 304; change sizes and see the price move.
2. Buyer: add 2–3 lines, open Cart, place order → proforma.
3. Raw-material vendor: What I Supply → add those shape/grade pairs.
4. Admin: Raw Material Marketplace → open the order → assign vendor, freight → approve.
5. Buyer: pay → vendor sees the order under Orders and can advance it.

## Before go-live
- **Replace the indicative rates** (Admin → Raw Material Marketplace → Rate card).
- **Payment gateway:** `rm_pay_order` records a successful payment without a gateway
  (same as the existing checkout). Wire the gateway and call `rm_pay_order` from its verified webhook
  (`src/app/buyer/orders/[id]/rmActions.ts` has the TODO).
- Set the seller env vars; legal review of the proforma terms text.
- Old vendor "listings" pages still exist but are out of the navigation; remove when ready.

## Dev notes
- Catalogue source: `supabase/scripts/gen_rm_catalog_seed.py` → regenerates 0009 (idempotent; never overwrites edited rates).
- Live preview maths: `src/lib/rawMaterials/weight.ts` mirrors the SQL. Check parity with
  `DATABASE_URL=… node scripts/check-rm-pricing-parity.mjs 2000` (3,000 random lines: 0 mismatches).
