alter table public.autopacks
  add column if not exists evidence_trace jsonb not null default '{}'::jsonb;
