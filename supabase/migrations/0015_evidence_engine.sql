alter table public.applications
  add column if not exists selected_evidence jsonb not null default '[]'::jsonb;
