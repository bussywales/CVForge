-- Billing settings per user
create table if not exists public.billing_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_plan text,
  auto_topup_enabled boolean not null default false,
  auto_topup_pack_key text,
  auto_topup_threshold int not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_settings enable row level security;

create policy "Users can read their billing settings" on public.billing_settings
for select using (auth.uid() = user_id);

create policy "Users can upsert their billing settings" on public.billing_settings
for insert with check (auth.uid() = user_id);

create policy "Users can update their billing settings" on public.billing_settings
for update using (auth.uid() = user_id);

create policy "Users can delete their billing settings" on public.billing_settings
for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger billing_settings_updated_at
before update on public.billing_settings
for each row execute function public.set_updated_at();
