-- =====================================================================
-- MECHmetrIQ (MechOneHub) — Razorpay / Payment Gateway Webhook Idempotency
-- Stores processed webhook event IDs so duplicate deliveries are ignored.
-- Service-role access only (RLS enabled with zero policies).
-- =====================================================================

create table if not exists public.payment_webhook_events (
  event_id     text primary key,
  provider     text not null default 'razorpay',
  event_type   text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

comment on table public.payment_webhook_events is
  'Idempotency log for verified payment gateway webhooks. Server-only (service_role).';

alter table public.payment_webhook_events enable row level security;

revoke all on public.payment_webhook_events from anon, authenticated;
