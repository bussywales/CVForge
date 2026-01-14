create table if not exists public.application_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  gap_key text not null,
  evidence_id text not null,
  source_type text,
  source_id uuid,
  match_score numeric,
  quality_score int,
  created_at timestamptz not null default now()
);

alter table public.application_evidence enable row level security;

create policy "Users can manage their application evidence"
  on public.application_evidence
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index if not exists application_evidence_unique_idx
  on public.application_evidence (user_id, application_id, gap_key);

create index if not exists application_evidence_app_gap_idx
  on public.application_evidence (application_id, gap_key);
