-- Align local migration history with remote applied version.
-- Adds fetch status metadata columns for job advert fetches.
alter table public.applications
  add column if not exists job_fetch_http_status int,
  add column if not exists job_fetch_hint text;

create index if not exists applications_job_fetch_status_idx on public.applications (job_fetch_status);
