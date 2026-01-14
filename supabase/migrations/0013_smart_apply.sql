alter table public.applications
  add column if not exists closing_date date,
  add column if not exists submitted_at timestamptz,
  add column if not exists source_platform text;

create table if not exists public.application_apply_checklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  cv_exported_at timestamptz,
  cover_exported_at timestamptz,
  interview_pack_exported_at timestamptz,
  kit_downloaded_at timestamptz,
  outreach_step1_logged_at timestamptz,
  followup_scheduled_at timestamptz,
  submitted_logged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, application_id)
);

alter table public.application_apply_checklist enable row level security;

create policy "Users can select their apply checklist"
  on public.application_apply_checklist for select
  using (auth.uid() = user_id);

create policy "Users can insert their apply checklist"
  on public.application_apply_checklist for insert
  with check (auth.uid() = user_id);

create policy "Users can update their apply checklist"
  on public.application_apply_checklist for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their apply checklist"
  on public.application_apply_checklist for delete
  using (auth.uid() = user_id);

create index if not exists application_apply_checklist_user_app_idx
  on public.application_apply_checklist (user_id, application_id);
