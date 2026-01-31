alter table public.ops_case_workflow
  add column if not exists sla_due_at timestamptz;

update public.ops_case_workflow
set sla_due_at = case
  when priority = 'p0' then created_at + interval '15 minutes'
  when priority = 'p1' then created_at + interval '60 minutes'
  when priority = 'p2' then created_at + interval '4 hours'
  when priority = 'p3' then created_at + interval '24 hours'
  else created_at + interval '4 hours'
end
where sla_due_at is null;

create or replace function public.ops_case_set_sla_due_at()
returns trigger as $$
begin
  new.sla_due_at = case
    when new.priority = 'p0' then new.created_at + interval '15 minutes'
    when new.priority = 'p1' then new.created_at + interval '60 minutes'
    when new.priority = 'p2' then new.created_at + interval '4 hours'
    when new.priority = 'p3' then new.created_at + interval '24 hours'
    else new.created_at + interval '4 hours'
  end;
  return new;
end;
$$ language plpgsql;

drop trigger if exists ops_case_workflow_sla_trigger on public.ops_case_workflow;
create trigger ops_case_workflow_sla_trigger
before insert or update of priority, created_at on public.ops_case_workflow
for each row execute function public.ops_case_set_sla_due_at();

create index if not exists ops_case_workflow_sla_due_idx on public.ops_case_workflow (sla_due_at);
