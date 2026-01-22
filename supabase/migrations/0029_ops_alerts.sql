create table if not exists public.ops_alert_states (
  key text primary key,
  state text not null check (state in ('ok','firing')),
  started_at timestamptz,
  last_seen_at timestamptz,
  last_notified_at timestamptz,
  last_payload_hash text,
  updated_at timestamptz default now()
);

create table if not exists public.ops_alert_events (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  state text not null check (state in ('ok','firing')),
  at timestamptz not null default now(),
  summary_masked text,
  signals_masked jsonb default '[]'::jsonb,
  window text,
  rules_version text
);

create index if not exists ops_alert_events_at_idx on public.ops_alert_events (at desc);
create index if not exists ops_alert_events_key_idx on public.ops_alert_events (key, at desc);

alter table public.ops_alert_states enable row level security;
alter table public.ops_alert_events enable row level security;

create policy "ops alerts read ops" on public.ops_alert_states
  for select using (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role');

create policy "ops alerts write service" on public.ops_alert_states
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "ops alert events read ops" on public.ops_alert_events
  for select using (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role');

create policy "ops alert events write service" on public.ops_alert_events
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.set_ops_alert_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ops_alert_states_updated_at on public.ops_alert_states;
create trigger trg_ops_alert_states_updated_at
before update on public.ops_alert_states
for each row execute procedure public.set_ops_alert_states_updated_at();
