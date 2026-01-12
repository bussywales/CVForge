create table if not exists public.application_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  type text not null,
  channel text,
  subject text,
  body text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.application_activities enable row level security;

create policy "Users can manage their activities"
  on public.application_activities
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists activities_user_app_occurred_idx
  on public.application_activities (user_id, application_id, occurred_at desc);
