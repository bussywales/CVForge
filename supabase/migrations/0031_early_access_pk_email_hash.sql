-- Fix early access allowlist to support email-only invites and nullable user_id

alter table public.early_access_allowlist
  add column if not exists id uuid default gen_random_uuid();

alter table public.early_access_allowlist
  add column if not exists email_hash text,
  add column if not exists email_domain text,
  add column if not exists invited_at timestamptz default now(),
  add column if not exists invited_by uuid references auth.users (id);

-- Populate email_hash if missing (fallback to hashed user_id to avoid nulls)
update public.early_access_allowlist
set email_hash = coalesce(email_hash, encode(digest(coalesce(user_id::text, 'legacy'), 'sha256'), 'hex'))
where email_hash is null;

-- Drop old primary key on user_id and allow null user_id
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'early_access_allowlist_pkey') then
    alter table public.early_access_allowlist drop constraint early_access_allowlist_pkey;
  end if;
end$$;

alter table public.early_access_allowlist
  alter column id set not null,
  alter column user_id drop not null,
  alter column email_hash set not null;

alter table public.early_access_allowlist
  add constraint early_access_allowlist_pkey primary key (id);

-- Indexes and uniqueness
create index if not exists early_access_allowlist_revoked_at_idx on public.early_access_allowlist (revoked_at);
create index if not exists early_access_allowlist_granted_at_idx on public.early_access_allowlist (invited_at desc);
create unique index if not exists early_access_allowlist_active_email_hash_idx on public.early_access_allowlist (email_hash) where revoked_at is null;
create unique index if not exists early_access_allowlist_active_user_id_idx on public.early_access_allowlist (user_id) where revoked_at is null and user_id is not null;
