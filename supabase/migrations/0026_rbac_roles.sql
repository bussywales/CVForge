-- RBAC tables for roles and ops audit logging
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('user','support','admin','super_admin')) default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ops_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  actor_user_id uuid references auth.users(id),
  target_user_id uuid references auth.users(id),
  action text not null,
  meta jsonb not null default '{}'::jsonb
);

alter table public.user_roles enable row level security;
alter table public.ops_audit_log enable row level security;

create policy "allow self role read" on public.user_roles
  for select
  using (auth.uid() = user_id);

create policy "service role full access" on public.user_roles
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role append" on public.ops_audit_log
  for insert
  with check (auth.role() = 'service_role');

create policy "service role read" on public.ops_audit_log
  for select
  using (auth.role() = 'service_role');

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_roles_updated_at on public.user_roles;
create trigger set_user_roles_updated_at
before update on public.user_roles
for each row execute procedure public.set_updated_at();
