alter table public.applications
  add column if not exists applied_at timestamptz,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists company_name text,
  add column if not exists last_touch_at timestamptz,
  add column if not exists next_followup_at timestamptz,
  add column if not exists source text;

update public.applications
  set status = 'draft'
  where status is null;

update public.applications
  set status = 'interviewing'
  where status = 'interview';

alter table public.applications
  alter column status set default 'draft';

alter table public.applications
  alter column status set not null;

create index if not exists applications_user_status_idx
  on public.applications (user_id, status);

create index if not exists applications_user_next_followup_idx
  on public.applications (user_id, next_followup_at);
