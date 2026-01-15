create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;
alter table public.referral_redemptions enable row level security;

create policy "Users can manage their referral code" on public.referral_codes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Invitees can view their redemptions" on public.referral_redemptions
for select using (auth.uid() = invitee_user_id or auth.uid() = inviter_user_id);

create or replace function public.set_referral_code_updated_at()
returns trigger as $$
begin
  new.created_at = coalesce(new.created_at, now());
  return new;
end;
$$ language plpgsql;

create trigger referral_codes_created_at
before insert on public.referral_codes
for each row execute function public.set_referral_code_updated_at();
