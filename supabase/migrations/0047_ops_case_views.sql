create table if not exists public.ops_case_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  view jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ops_case_views_user_name_idx on public.ops_case_views (user_id, name);
create unique index if not exists ops_case_views_default_idx on public.ops_case_views (user_id) where is_default;
create index if not exists ops_case_views_user_updated_idx on public.ops_case_views (user_id, updated_at desc);

alter table public.ops_case_views enable row level security;

create policy "ops case views read own" on public.ops_case_views
  for select using (
    (
      auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
      and auth.uid() = user_id
    )
    or auth.role() = 'service_role'
  );

create policy "ops case views insert own" on public.ops_case_views
  for insert with check (
    (
      auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
      and auth.uid() = user_id
    )
    or auth.role() = 'service_role'
  );

create policy "ops case views update own" on public.ops_case_views
  for update using (
    (
      auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
      and auth.uid() = user_id
    )
    or auth.role() = 'service_role'
  )
  with check (
    (
      auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
      and auth.uid() = user_id
    )
    or auth.role() = 'service_role'
  );

create policy "ops case views delete own" on public.ops_case_views
  for delete using (
    (
      auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
      and auth.uid() = user_id
    )
    or auth.role() = 'service_role'
  );
