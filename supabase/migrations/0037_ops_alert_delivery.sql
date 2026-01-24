-- Ops alert delivery receipts
create table if not exists public.ops_alert_delivery (
  id bigserial primary key,
  event_id uuid not null,
  channel text not null default 'webhook',
  status text not null,
  at timestamptz not null default now(),
  masked_reason text,
  provider_ref text,
  window_label text,
  created_at timestamptz not null default now()
);

create index if not exists ops_alert_delivery_event_id_idx on public.ops_alert_delivery (event_id);
create index if not exists ops_alert_delivery_status_idx on public.ops_alert_delivery (status);
create index if not exists ops_alert_delivery_at_idx on public.ops_alert_delivery (at desc);

alter table public.ops_alert_delivery enable row level security;
