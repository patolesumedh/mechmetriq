-- Adds structured DFM (design-for-manufacturing) spec fields to rfqs,
-- matching the configurator fields buyers expect from an instant-quoting
-- flow: preferred subprocess, finish options, threads/tapped holes,
-- inserts, precision tolerance/roughness tiers, part marking, inspection
-- level, and required certificates.

alter table public.rfqs
  add column if not exists subprocess text,
  add column if not exists finish_options text[] not null default '{}'::text[],
  add column if not exists threads_qty integer,
  add column if not exists inserts_qty integer,
  add column if not exists surface_roughness text,
  add column if not exists part_marking text[] not null default '{}'::text[],
  add column if not exists inspection text,
  add column if not exists certificates text[] not null default '{}'::text[];

comment on column public.rfqs.subprocess is 'Preferred manufacturing subprocess (e.g. CNC Milling, CNC Turning) when process is CNC Machining.';
comment on column public.rfqs.finish_options is 'Selected finish options (Standard, Black Anodize, etc.) - multi-select.';
comment on column public.rfqs.threads_qty is 'Total number of threads/tapped holes required on the part; null means not required.';
comment on column public.rfqs.inserts_qty is 'Total number of standard inserts required on the part; null means not required.';
comment on column public.rfqs.surface_roughness is 'Selected precision surface roughness tier label.';
comment on column public.rfqs.part_marking is 'Selected part marking options (Silkscreen, Laser Mark, etc.) - multi-select.';
comment on column public.rfqs.inspection is 'Selected inspection tier label.';
comment on column public.rfqs.certificates is 'Selected required certificates/supplier qualifications - multi-select.';
