-- =====================================================================
-- MECHmetriQ — Smart Quote v1: STEP file analysis results
-- =====================================================================
-- One row per STEP file attached to an RFQ. The website creates the row
-- when the RFQ is submitted, sends the file to the parser service, and
-- stores the JSON it returns.
--
-- Writes happen only on the server with the service-role key, so a buyer
-- can never create or edit an analysis (it will feed pricing later).
-- Buyers can read their own; admins can read all. Vendors: no access yet.
-- =====================================================================

create table public.cad_analyses (
  id               uuid primary key default gen_random_uuid(),
  rfq_id           uuid not null references public.rfqs (id) on delete cascade,
  buyer_id         uuid not null references public.profiles (id) on delete cascade,
  storage_path     text not null,              -- path in bucket rfq-attachments
  file_name        text not null,
  status           text not null default 'pending'
                   check (status in ('pending', 'processing', 'completed', 'failed')),
  error            text,
  result           jsonb,                      -- full parser output
  summary          jsonb,                      -- small subset for lists
  analysis_version text,
  processing_ms    integer,
  attempts         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz,
  unique (rfq_id, storage_path)
);

comment on table public.cad_analyses is
  'Smart Quote v1: geometry/feature analysis of STEP files attached to RFQs. Server-only writes.';

create index cad_analyses_rfq_id_idx   on public.cad_analyses (rfq_id);
create index cad_analyses_buyer_id_idx on public.cad_analyses (buyer_id);
create index cad_analyses_status_idx   on public.cad_analyses (status) where status in ('pending', 'processing');

create trigger trg_cad_analyses_updated before update on public.cad_analyses
  for each row execute function set_updated_at();

alter table public.cad_analyses enable row level security;

-- Read: owning buyer or admin. No insert/update/delete policies on purpose.
create policy "cad_analyses_select_own_or_admin" on public.cad_analyses
  for select to authenticated
  using (buyer_id = (select auth.uid()) or (select is_admin()));

revoke insert, update, delete on public.cad_analyses from anon, authenticated;
