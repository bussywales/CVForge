create table if not exists public.ops_case_evidence (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.ops_case_workflow(request_id) on delete cascade,
  type text not null,
  body text not null,
  meta jsonb,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ops_case_evidence_type_chk'
  ) then
    alter table public.ops_case_evidence
      add constraint ops_case_evidence_type_chk
      check (type in ('note','link','screenshot_ref','decision'));
  end if;
end $$;

create index if not exists ops_case_evidence_request_idx on public.ops_case_evidence (request_id, created_at desc);

alter table public.ops_case_evidence enable row level security;

create policy "ops case evidence read ops" on public.ops_case_evidence
  for select using (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  );

create policy "ops case evidence insert ops" on public.ops_case_evidence
  for insert with check (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  );

create policy "ops case evidence update admin" on public.ops_case_evidence
  for update using (
    auth.uid() in (select user_id from public.user_roles where role in ('admin','super_admin'))
    or auth.role() = 'service_role'
  )
  with check (
    auth.uid() in (select user_id from public.user_roles where role in ('admin','super_admin'))
    or auth.role() = 'service_role'
  );

create policy "ops case evidence delete admin" on public.ops_case_evidence
  for delete using (
    auth.uid() in (select user_id from public.user_roles where role in ('admin','super_admin'))
    or auth.role() = 'service_role'
  );
