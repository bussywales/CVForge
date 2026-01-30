create table if not exists public.ops_case_workflow (
  request_id text primary key,
  status text not null default 'open',
  priority text not null default 'medium',
  assigned_to_user_id uuid references auth.users(id),
  claimed_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_touched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ops_case_workflow_status_chk'
  ) then
    alter table public.ops_case_workflow
      add constraint ops_case_workflow_status_chk
      check (status in ('open','investigating','monitoring','resolved','closed'));
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ops_case_workflow_priority_chk'
  ) then
    alter table public.ops_case_workflow
      add constraint ops_case_workflow_priority_chk
      check (priority in ('low','medium','high'));
  end if;
end $$;

create index if not exists ops_case_workflow_assigned_idx on public.ops_case_workflow (assigned_to_user_id);
create index if not exists ops_case_workflow_status_idx on public.ops_case_workflow (status);
create index if not exists ops_case_workflow_last_touched_idx on public.ops_case_workflow (last_touched_at desc);

alter table public.ops_case_workflow enable row level security;

create policy "ops case workflow read ops" on public.ops_case_workflow
  for select using (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  );

create policy "ops case workflow insert ops" on public.ops_case_workflow
  for insert with check (
    auth.role() = 'service_role'
    or auth.uid() in (select user_id from public.user_roles where role in ('admin','super_admin'))
    or (
      auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
      and (assigned_to_user_id is null or assigned_to_user_id = auth.uid())
    )
  );

create policy "ops case workflow update ops" on public.ops_case_workflow
  for update using (
    auth.role() = 'service_role'
    or auth.uid() in (select user_id from public.user_roles where role in ('admin','super_admin'))
    or (
      auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
      and (assigned_to_user_id is null or assigned_to_user_id = auth.uid())
    )
  )
  with check (
    auth.role() = 'service_role'
    or auth.uid() in (select user_id from public.user_roles where role in ('admin','super_admin'))
    or (
      auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
      and (assigned_to_user_id is null or assigned_to_user_id = auth.uid())
    )
  );
