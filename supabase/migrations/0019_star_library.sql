create table if not exists public.star_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  gap_key text not null,
  signal_key text null,
  title text not null,
  situation text not null default '',
  task text not null default '',
  action text not null default '',
  result text not null default '',
  evidence_ids uuid[] not null default '{}'::uuid[],
  quality_hint text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint star_library_gap_unique unique (user_id, application_id, gap_key)
);

create index if not exists star_library_app_idx
  on public.star_library (application_id);

alter table public.star_library enable row level security;

create policy "Users can select their star library"
  on public.star_library
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their star library"
  on public.star_library
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their star library"
  on public.star_library
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their star library"
  on public.star_library
  for delete
  using (auth.uid() = user_id);

drop trigger if exists set_star_library_updated_at on public.star_library;

create trigger set_star_library_updated_at
before update on public.star_library
for each row
execute function public.set_updated_at();
