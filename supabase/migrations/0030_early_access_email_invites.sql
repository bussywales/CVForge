alter table public.early_access_allowlist
  alter column user_id drop not null;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'early_access_allowlist' and column_name = 'email_hash') then
    alter table public.early_access_allowlist add column email_hash text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'early_access_allowlist' and column_name = 'email_domain') then
    alter table public.early_access_allowlist add column email_domain text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'early_access_allowlist' and column_name = 'invited_at') then
    alter table public.early_access_allowlist add column invited_at timestamptz default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'early_access_allowlist' and column_name = 'invited_by') then
    alter table public.early_access_allowlist add column invited_by uuid references auth.users (id);
  end if;
end$$;

update public.early_access_allowlist
set email_hash = coalesce(email_hash, encode(digest(coalesce(user_id::text, 'legacy'), 'sha256'), 'hex'))
where email_hash is null;

alter table public.early_access_allowlist alter column email_hash set not null;

drop index if exists early_access_allowlist_revoked_at_idx;
create index if not exists early_access_allowlist_revoked_at_idx on public.early_access_allowlist (revoked_at);
create index if not exists early_access_allowlist_granted_at_idx on public.early_access_allowlist (invited_at desc);

drop index if exists early_access_allowlist_active_email_hash_idx;
create unique index if not exists early_access_allowlist_active_email_hash_idx on public.early_access_allowlist (email_hash) where revoked_at is null;
