# Contributing to MECHmetrIQ (MechOneHub)

This guide defines our branching, database migration, and release workflow across `staging.mechonehub.com` and `mechonehub.com`.

## 1. Branching Model

- **`staging`** (default development target): Automatically deploys to `https://staging.mechonehub.com` (protected behind Cloudflare Access).
- **`main`** (production): Deploys to `https://mechonehub.com` after required reviewer approval in the `production` GitHub Environment and creates a SemVer GitHub Release (`vX.Y.Z`).
- **Working branches:** Always branch off `staging` using `feature/<slug>`, `fix/<slug>`, or `chore/<slug>`.
- **No direct pushes or GitHub web-UI file uploads** to `staging` or `main`.

## 2. Pull Requests & Merge Rules

1. **Feature / Fix PR (`feature/*` -> `staging`):**
   - PR title **must** follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `chore:`, `test:`, `release:`).
   - All CI checks (`web`, `parser`, `migrations`, `security`, `pr-title`) must pass.
   - Merge using **Squash and merge**.
2. **Release PR (`staging` -> `main`):**
   - Open using the Release template (`?template=release.md`), titled `release: vX.Y.Z`.
   - Apply one label: `release:major`, `release:minor`, or `release:patch`.
   - Complete the staging smoke-test checklist.
   - Merge using **Create a merge commit** (never squash `staging` into `main`, so git history stays aligned).
3. **Emergency Hotfix (`hotfix/*` -> `main`):**
   - Branch off `main` as `hotfix/<slug>`.
   - Open a PR to `main` (Squash and merge after review).
   - Immediately open a back-merge PR `main` -> `staging` (Create a merge commit) so `staging` receives the fix.

## 3. Database Migrations (Expand -> Migrate -> Contract)

- Every schema change goes into a new numbered file in `supabase/migrations/00NN_<description>.sql`.
- **Never edit an existing migration** that has already been merged to `staging` or `main`, and never run ad-hoc DDL in the Supabase production SQL Editor.
- CI runs `supabase db push` **before** deploying new application containers. Therefore, every migration must be backwards-compatible with the currently running code:
  1. **Expand:** Add nullable columns, new tables, or views first.
  2. **Migrate:** Deploy code that writes to / reads from the new structure and backfill data.
  3. **Contract:** Remove legacy columns or constraints in a subsequent release PR.

## 4. Local Setup

```bash
cp .env.example .env.local
npm ci
npm run lint
npm run typecheck
npm run dev
```
