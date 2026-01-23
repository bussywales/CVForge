create table if not exists public.ops_alert_snoozes (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  window_label text not null,
  snoozed_by_user_id uuid not null,
  snoozed_at timestamptz not null default now(),
  until_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists ops_alert_snoozes_alert_idx on public.ops_alert_snoozes (alert_key, window_label, until_at);

alter table public.ops_alert_snoozes enable row level security;

create policy "ops alert snoozes read ops" on public.ops_alert_snoozes
  for select using (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role');

create policy "ops alert snoozes write service" on public.ops_alert_snoozes
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
