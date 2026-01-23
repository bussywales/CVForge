create table if not exists public.ops_alert_ownership (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  window_label text not null,
  event_id uuid,
  claimed_by_user_id uuid not null,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists ops_alert_ownership_alert_window_idx on public.ops_alert_ownership (alert_key, window_label, expires_at);
create index if not exists ops_alert_ownership_user_idx on public.ops_alert_ownership (claimed_by_user_id, expires_at);

alter table public.ops_alert_ownership enable row level security;

create policy "ops alert ownership read ops" on public.ops_alert_ownership
  for select using (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role');

create policy "ops alert ownership write service" on public.ops_alert_ownership
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
