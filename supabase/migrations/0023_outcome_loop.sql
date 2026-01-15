-- Application outcomes and action links
create table if not exists public.application_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  application_id uuid not null references public.applications(id) on delete cascade,
  outcome_status text not null,
  outcome_reason text null,
  outcome_notes text null,
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.application_outcomes enable row level security;

create policy "Users can select their outcomes" on public.application_outcomes
  for select using (auth.uid() = user_id);
create policy "Users can insert their outcomes" on public.application_outcomes
  for insert with check (auth.uid() = user_id);
create policy "Users can update their outcomes" on public.application_outcomes
  for update using (auth.uid() = user_id);
create policy "Users can delete their outcomes" on public.application_outcomes
  for delete using (auth.uid() = user_id);

create index if not exists application_outcomes_user_app_idx
  on public.application_outcomes (user_id, application_id, happened_at desc);

create table if not exists public.outcome_action_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  application_id uuid not null references public.applications(id) on delete cascade,
  outcome_id uuid not null references public.application_outcomes(id) on delete cascade,
  action_key text not null,
  action_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.outcome_action_links enable row level security;

create policy "Users can select their outcome actions" on public.outcome_action_links
  for select using (auth.uid() = user_id);
create policy "Users can insert their outcome actions" on public.outcome_action_links
  for insert with check (auth.uid() = user_id);
create policy "Users can update their outcome actions" on public.outcome_action_links
  for update using (auth.uid() = user_id);
create policy "Users can delete their outcome actions" on public.outcome_action_links
  for delete using (auth.uid() = user_id);

create index if not exists outcome_action_links_user_app_idx
  on public.outcome_action_links (user_id, application_id, outcome_id);

alter table public.applications
  add column if not exists last_outcome_status text,
  add column if not exists last_outcome_reason text,
  add column if not exists last_outcome_id uuid,
  add column if not exists last_outcome_at timestamptz;

create index if not exists applications_last_outcome_status_idx on public.applications (last_outcome_status);
create index if not exists applications_last_outcome_at_idx on public.applications (last_outcome_at);
