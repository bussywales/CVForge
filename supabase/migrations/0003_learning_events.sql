alter table public.profiles
  add column if not exists telemetry_opt_in boolean not null default false;

create table if not exists public.role_fit_learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  job_title text,
  job_url text,
  domain_guess text,
  jd_length int not null,
  matched_signals text[] not null default '{}',
  missing_signals text[] not null default '{}',
  top_terms text[] not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists role_fit_learning_events_unique
  on public.role_fit_learning_events (user_id, application_id, (date_trunc('day', created_at)));

alter table public.role_fit_learning_events enable row level security;

create policy "Users can insert their learning events"
  on public.role_fit_learning_events
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.telemetry_opt_in = true
    )
  );

create policy "Users can read their learning events"
  on public.role_fit_learning_events
  for select
  using (auth.uid() = user_id);
