update public.ops_case_workflow
set priority = case
  when priority = 'high' then 'p1'
  when priority = 'medium' then 'p2'
  when priority = 'low' then 'p3'
  else priority
end;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'ops_case_workflow_priority_chk'
  ) then
    alter table public.ops_case_workflow
      drop constraint ops_case_workflow_priority_chk;
  end if;
  if exists (
    select 1
    from pg_constraint
    where conname = 'ops_case_workflow_status_chk'
  ) then
    alter table public.ops_case_workflow
      drop constraint ops_case_workflow_status_chk;
  end if;
end $$;

alter table public.ops_case_workflow
  alter column priority set default 'p2';

alter table public.ops_case_workflow
  add constraint ops_case_workflow_status_chk
  check (status in ('open','investigating','monitoring','waiting_on_user','waiting_on_provider','resolved','closed'));

alter table public.ops_case_workflow
  add constraint ops_case_workflow_priority_chk
  check (priority in ('p0','p1','p2','p3'));

create index if not exists ops_case_workflow_priority_idx on public.ops_case_workflow (priority);
create index if not exists ops_case_workflow_updated_idx on public.ops_case_workflow (updated_at desc);
