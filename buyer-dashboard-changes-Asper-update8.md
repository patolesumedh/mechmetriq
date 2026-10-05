# MECHmetriQ Buyer Dashboard — Change List

Batched flow-update requests from the buyer dashboard review (started 5 Oct 2026). Logged here as each item is decided so a fresh session can pick up without re-asking. Status: **not yet built** — will be implemented together and pushed as one batch per the usual workflow.

## 1. Merge "My Quotes" and "Cart" into one nav item — LOCKED
Buyer nav today (`src/app/buyer/layout.tsx`): Overview, Get Instant Quote, My Quotes, My Orders, Raw Materials, Cart, Addresses, Profile (8 items). Confusion: what's the difference between My Quotes / My Orders / Cart, and can any combine.

Decision: My Quotes (custom-part RFQs awaiting price/acceptance) and Cart (raw-material items awaiting checkout) are the same conceptual stage — "in progress before becoming an Order" — just for the two different engines (custom manufacturing vs. raw materials). My Orders already unifies both engines post-conversion, so mirror that.

**Build this way:**
- One nav item, **"Quotes & Cart"**, replacing both "My Quotes" and "Cart". Nav goes from 8 items to 7.
- Two tabs on that page: **"Custom Part Quotes"** (today's `/buyer/quotes` content, unchanged — RFQ cards, CAD analysis, price block, vendor quotes, Accept Quote) and **"Raw Material Cart"** (today's `/buyer/cart` content, unchanged — line items, order summary, Place Order).
- The cart-items badge count (currently on "Cart" in the sidebar) moves to the combined nav item.
- My Orders (`/buyer/orders`) is untouched — stays the single unified destination for both `order_type: custom_part` and `order_type: raw_material` after conversion.
- Likely route: keep both existing routes (`/buyer/quotes`, `/buyer/cart`) working as deep links into the right tab, with the nav item pointing at one of them (e.g. `/buyer/quotes?tab=cart` style or a new shared layout) — decide exact routing at build time, no user-facing behavior change needed beyond the nav/tabs.

## 2. Profile page — new mandatory fields + GST — LOCKED (defaults applied, no objection raised)
Today `profiles` table only has: `email`, `full_name`, `phone`, `role`, verification flags. `ProfileForm.tsx` only collects Full name (required) and Phone (optional); email is read-only.

Requested: make Name, Address, Contact, Email mandatory; add a GST checkbox that makes GSTIN mandatory when checked; add Organization Name.

**Build this way:**
- **Full name*** — already required, keep.
- **Email*** — already present/read-only, keep (comes from auth signup).
- **Contact / Phone*** — currently optional, make **required**.
- **Billing / Organization Address*** — new single-line/structured address field stored on the buyer's profile (or a linked table), **separate** from the existing Addresses page. Addresses page keeps managing multiple *delivery* addresses used at checkout; this new field is the one registered/billing address tied to the account, mandatory for every buyer.
- **GST Registered** — new checkbox on Profile.
  - Unchecked (default): Organization Name and GSTIN are optional.
  - Checked: **Organization Name becomes required** and **GSTIN becomes required**, validated server-side with the same format regex already used for vendors (`GSTIN_RE` in `src/lib/kyc/rules.ts`): `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`.
- Organization Name itself: optional field, not mandatory on its own — only required once GST Registered is checked.
- Needs a new migration adding to `profiles` (or a new linked table): `organization_name text`, `gst_registered boolean not null default false`, `gstin text`, plus address columns (or reuse the `addresses` table shape: `full_address`, `pincode`) for the billing address. Existing rows default to GST unregistered / null address — will need a one-time "complete your profile" nudge since these are now mandatory for a field that's currently empty for every existing buyer.
- Open question for build time: block dashboard actions (e.g. submitting an RFQ, placing a raw-material order) until the mandatory fields are filled, or just make them required on the Profile form itself going forward? Default assumption unless told otherwise: enforce only on the Profile form (can't save with them blank); don't retroactively block existing flows for buyers who haven't filled it in yet.

## Still being logged
More flows pending from this review — see chat for the latest before building.
