create table if not exists public.work_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_title text not null,
  company text not null,
  location text null,
  start_date date not null,
  end_date date null,
  is_current boolean not null default false,
  summary text null,
  bullets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_history_current_end_date check (
    (is_current = true and end_date is null)
    or (is_current = false)
  ),
  constraint work_history_end_after_start check (
    end_date is null or end_date >= start_date
  ),
  constraint work_history_bullets_array check (jsonb_typeof(bullets) = 'array')
);

create index if not exists work_history_user_start_idx
  on public.work_history (user_id, start_date desc);

create index if not exists work_history_user_current_idx
  on public.work_history (user_id, is_current);

alter table public.work_history enable row level security;

create policy "Users can select their work history"
  on public.work_history
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their work history"
  on public.work_history
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their work history"
  on public.work_history
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their work history"
  on public.work_history
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_work_history_updated_at on public.work_history;

create trigger set_work_history_updated_at
before update on public.work_history
for each row
execute function public.set_updated_at();
