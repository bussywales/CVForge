alter table public.ops_request_context
  add column if not exists source text,
  add column if not exists confidence text,
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ops_request_context_confidence_chk'
  ) then
    alter table public.ops_request_context
      add constraint ops_request_context_confidence_chk
      check (confidence in ('high', 'medium') or confidence is null);
  end if;
end $$;

create index if not exists ops_request_context_updated_idx on public.ops_request_context (updated_at desc);
