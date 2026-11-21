-- =====================================================================
-- MECHmetrIQ (MechOneHub) — Public read-only health ping view for
-- automated 48-hour Supabase keep-alive checks using the anon key
-- (no service_role key required in scheduled CI jobs).
-- =====================================================================

create or replace view public.health_ping with (security_invoker = true) as select 1 as ok;
grant select on public.health_ping to anon;
