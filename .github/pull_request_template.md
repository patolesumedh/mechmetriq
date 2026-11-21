## Summary
<!-- What does this PR change and why? Ensure the PR title follows Conventional Commits (e.g., feat: ..., fix: ..., chore: ...). -->

## Type of Change
- [ ] `feat`: New feature
- [ ] `fix`: Bug fix
- [ ] `perf` / `refactor`: Performance or internal refactoring
- [ ] `docs` / `chore` / `test`: Documentation, tooling, or tests

## Database Migrations (if applicable)
- [ ] No database migrations in this PR
- [ ] New sequential migration added under `supabase/migrations/` (no duplicate numeric prefix)
- [ ] Follows **Expand -> Migrate -> Contract** (compatible with currently running production code)
- [ ] No existing merged migration files were edited

## Security & Quality Checklist
- [ ] `npm run lint`, `npm run typecheck`, and `npm run build` pass locally
- [ ] No secrets, API keys, or environment files committed
- [ ] RLS policies / ownership checks verified for any new data or storage paths
- [ ] KYC documents remain on Supabase Storage; CAD files use signed URLs

## Verification / Screenshots
<!-- Describe how you tested this change locally. -->
