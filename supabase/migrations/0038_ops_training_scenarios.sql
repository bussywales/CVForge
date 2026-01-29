create table if not exists public.ops_training_scenarios (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  scenario_type text not null,
  window_label text not null default '15m',
  event_id uuid,
  request_id text,
  meta jsonb not null default '{}'::jsonb,
  is_active boolean not null default true
);

create index if not exists ops_training_scenarios_created_at_idx on public.ops_training_scenarios (created_at desc);
create index if not exists ops_training_scenarios_created_by_idx on public.ops_training_scenarios (created_by, created_at desc);
create index if not exists ops_training_scenarios_type_idx on public.ops_training_scenarios (scenario_type, created_at desc);

alter table public.ops_training_scenarios enable row level security;

create policy "ops training scenarios read ops" on public.ops_training_scenarios
  for select using (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role');

create policy "ops training scenarios insert ops" on public.ops_training_scenarios
  for insert with check (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role');

create policy "ops training scenarios update ops" on public.ops_training_scenarios
  for update using (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role')
  with check (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role');
