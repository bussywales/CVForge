create table if not exists public.early_access_invites (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  token text not null,
  invited_at timestamptz not null default now(),
  invited_by_user_id uuid references auth.users (id),
  claimed_at timestamptz,
  claimed_user_id uuid references auth.users (id),
  revoked_at timestamptz,
  expires_at timestamptz
);

create unique index if not exists early_access_invites_token_idx on public.early_access_invites (token);
create unique index if not exists early_access_invites_active_email_idx on public.early_access_invites (email_hash) where revoked_at is null and claimed_at is null;
create index if not exists early_access_invites_claimed_idx on public.early_access_invites (claimed_at desc);

alter table public.early_access_invites enable row level security;

create policy "ops invites read" on public.early_access_invites
  for select using (auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin')) or auth.role() = 'service_role');

create policy "ops invites write service" on public.early_access_invites
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
