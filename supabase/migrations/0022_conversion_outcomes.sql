alter table public.applications
  add column if not exists outcome_status text,
  add column if not exists outcome_at timestamptz,
  add column if not exists outcome_note text;

create index if not exists applications_outcome_status_idx on public.applications (outcome_status);
create index if not exists applications_outcome_at_idx on public.applications (outcome_at);
