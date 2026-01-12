create table if not exists public.domain_pack_proposals (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  domain_guess text not null,
  title text not null,
  signals jsonb not null,
  source_terms text[] not null default '{}',
  occurrences int not null default 1,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.domain_packs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  version int not null default 1,
  is_active boolean not null default true,
  pack jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.domain_pack_proposals enable row level security;
alter table public.domain_packs enable row level security;

create policy "Users can propose packs"
  on public.domain_pack_proposals
  for insert
  with check (
    auth.uid() = created_by
    and status = 'pending'
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.telemetry_opt_in = true
    )
  );

create policy "Authenticated can read active packs"
  on public.domain_packs
  for select
  using (auth.role() = 'authenticated' and is_active = true);
