alter table public.profiles
  add column if not exists invite_id uuid,
  add column if not exists invite_source text,
  add column if not exists invited_email_hash text,
  add column if not exists invited_at timestamptz;

create index if not exists profiles_invited_at_idx on public.profiles (invited_at desc);
