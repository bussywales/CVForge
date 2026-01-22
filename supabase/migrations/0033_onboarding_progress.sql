create table if not exists public.onboarding_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  skip_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_progress_updated_at_idx on public.onboarding_progress (updated_at desc);

alter table public.onboarding_progress enable row level security;

create policy "onboarding progress read" on public.onboarding_progress
  for select using (auth.uid() = user_id or auth.role() = 'service_role');

create policy "onboarding progress upsert" on public.onboarding_progress
  for all using (auth.uid() = user_id or auth.role() = 'service_role')
  with check (auth.uid() = user_id or auth.role() = 'service_role');
