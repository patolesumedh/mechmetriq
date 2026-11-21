-- =====================================================================
-- MECHmetrIQ (MechOneHub) — CAD analysis metadata for GCS signed uploads
-- and SHA-256 deduplication (expand-only migration).
-- =====================================================================

alter table public.cad_analyses
  add column if not exists sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  add column if not exists sha256_verified boolean not null default false,
  add column if not exists file_size bigint,
  add column if not exists content_type text;

create index if not exists cad_analyses_buyer_sha_idx
  on public.cad_analyses (buyer_id, sha256)
  where status = 'completed' and sha256_verified = true;
