create table if not exists public.application_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  company text null,
  role_title text null,
  status text not null default 'draft',
  source text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_packs_status_chk check (
    status in ('draft','in_progress','ready','exported','applied','archived')
  )
);

create index if not exists application_packs_user_idx
  on public.application_packs (user_id, updated_at desc);

alter table public.application_packs enable row level security;

create policy "Users can select their application packs"
  on public.application_packs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their application packs"
  on public.application_packs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their application packs"
  on public.application_packs
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their application packs"
  on public.application_packs
  for delete
  using (auth.uid() = user_id);

drop trigger if exists set_application_packs_updated_at on public.application_packs;

create trigger set_application_packs_updated_at
before update on public.application_packs
for each row
execute function public.set_updated_at();

create table if not exists public.application_pack_versions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.application_packs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_description text not null,
  inputs_masked jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  model_meta jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists application_pack_versions_user_idx
  on public.application_pack_versions (user_id, created_at desc);

create index if not exists application_pack_versions_pack_idx
  on public.application_pack_versions (pack_id, created_at desc);

alter table public.application_pack_versions enable row level security;

create policy "Users can select their pack versions"
  on public.application_pack_versions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their pack versions"
  on public.application_pack_versions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their pack versions"
  on public.application_pack_versions
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their pack versions"
  on public.application_pack_versions
  for delete
  using (auth.uid() = user_id);
