# MECHmetrIQ

Mechanical Intelligence. Smarter Quotations.

A two-engine platform: custom manufacturing quote-to-order (buyer uploads a
part spec → Machining/Fabrication vendors submit quotes → order → production
→ delivery) plus a raw materials marketplace (buyer browses/buys listed
metals, plastics, sheets from Raw Material Supplier vendors). Fabrication and
Raw Material vendors are separate roles with separate onboarding, KYC, and
dashboards.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, and Supabase
(Postgres, Auth, RLS).

## Stack

- **Next.js 16.3.1** — App Router, Turbopack, Server Actions. Note: this
  version renames `middleware.ts` to `proxy.ts` (see `src/proxy.ts`) and
  requires `params`/`cookies()`/`headers()` to be awaited everywhere.
- **React 19**, **TypeScript**, **Tailwind CSS v4** (CSS-first config via the
  `@theme` block in `src/app/globals.css` — no `tailwind.config.js`).
- **Supabase** — Postgres schema + Row Level Security policies per role
  (buyer/vendor/admin) in `supabase/migrations/`, seed data for the Category
  & Material Master in `supabase/seed.sql`.

## Project structure

```
src/app/
  page.tsx                homepage
  login/, register/       auth (buyer/vendor sign-up, vendor-type branching)
  buyer/                  buyer dashboard: quotes, orders, marketplace, checkout
  vendor/fabrication/     Machining/Fabrication vendor dashboard
  vendor/raw_material/    Raw Material Supplier vendor dashboard
  admin/                  admin dashboard: users, vendor KYC, catalog, disputes
src/components/           shared UI (Sidebar, Topbar, Card, Badge, Button)
src/lib/                  Supabase clients, generated DB types, cn() helper
src/proxy.ts              Next 16 proxy (session refresh) — replaces middleware.ts
supabase/migrations/      schema, security/perf fixes, RLS fixes (run in order)
supabase/seed.sql         Category & Material Master starter data
```

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.local.example` to `.env.local` and fill in your Supabase
   project's URL and anon/publishable key (Project Settings → API in the
   Supabase dashboard):

   ```bash
   cp .env.local.example .env.local
   ```

3. Apply the database schema to your Supabase project, in order:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push   # applies supabase/migrations/*.sql in order
   ```

   Or paste each file in `supabase/migrations/` (0001, then 0002, then 0003)
   into the Supabase SQL editor, followed by `supabase/seed.sql`.

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Deploying

1. Push this repo to GitHub.
2. Import the repo in [Vercel](https://vercel.com/new), add the two env vars
   from `.env.local` in the Vercel project settings, and deploy.

## Database

See `supabase/migrations/0001_init.sql` for the full schema: profiles,
vendor_profiles (with `vendor_type` splitting Fabrication vs Raw Material),
master_items (Category & Material Master — processes/materials/units/finishes
with self-referencing grades), rfqs, quotes, listings, orders, order_items,
payments, payouts, reviews, disputes, support_tickets, coupons — plus a
trigger that auto-populates `profiles`/`vendor_profiles` from
`auth.users.raw_user_meta_data` on signup, and RLS policies scoping every
table to the appropriate role.
