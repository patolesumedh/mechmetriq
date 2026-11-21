## Release PR: `staging` -> `main`
<!-- Title format: release: vX.Y.Z -->
<!-- Merge strategy: Create a merge commit (DO NOT squash when merging staging -> main) -->

## Release Version & Label
- [ ] `package.json` version bumped to match target release (`vX.Y.Z`)
- [ ] Applied exactly one release label to this PR: `release:major`, `release:minor`, or `release:patch`

## Database Migration Safety (Expand / Contract)
- [ ] All pending migrations in `supabase/migrations/` have already been applied and verified on **Staging**
- [ ] Every migration is backwards-compatible with the currently running production code (migrations run before traffic shifts)

## Staging Smoke-Test Checklist (`https://staging.mechonehub.com`)
- [ ] **Auth & Turnstile:** Sign-up, email OTP verification, login, password reset, and admin TOTP MFA (`aal2`) work
- [ ] **CAD Upload & Worker:** `.STEP` file direct upload to GCS succeeds, Pub/Sub triggers worker, HMAC callback updates analysis & thumbnail
- [ ] **Server-Side Pricing:** Live price preview (`/api/preview-price`) and RFQ quote submission compute accurately
- [ ] **Checkout & Guardrails:** Staging runs in `PAYMENTS_MODE=test`; `/api/health` returns `200 OK`
- [ ] **Security Headers & Origin Lock:** Direct `*.run.app` root returns `403 Forbidden`; `/api/internal/*` returns `404` at the edge

## Rollback Plan
If post-deploy checks fail, run the `deploy-production.yml` workflow via `workflow_dispatch` with the previous Cloud Run `revision` name to shift 100% traffic back in seconds.
