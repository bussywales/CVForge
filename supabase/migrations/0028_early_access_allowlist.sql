create table if not exists public.early_access_allowlist (
  user_id uuid primary key references auth.users (id),
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  note text
);

create index if not exists early_access_allowlist_revoked_at_idx on public.early_access_allowlist (revoked_at);
create index if not exists early_access_allowlist_granted_at_idx on public.early_access_allowlist (granted_at desc);

alter table public.early_access_allowlist enable row level security;

create policy "early access ops read" on public.early_access_allowlist
  for select using (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role');

create policy "early access ops write" on public.early_access_allowlist
  for insert with check (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role');

create policy "early access ops update" on public.early_access_allowlist
  for update using (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role')
  with check (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role');

create policy "early access service role delete" on public.early_access_allowlist
  for delete using (auth.role() = 'service_role');
