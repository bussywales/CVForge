alter table public.application_evidence
  add column if not exists use_cv boolean not null default true,
  add column if not exists use_cover boolean not null default true,
  add column if not exists use_star boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists application_evidence_app_idx
  on public.application_evidence (application_id);
