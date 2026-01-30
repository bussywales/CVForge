alter table public.ops_case_workflow
  add column if not exists sla_due_at timestamptz
  generated always as (
    case
      when priority = 'p0' then created_at + interval '15 minutes'
      when priority = 'p1' then created_at + interval '60 minutes'
      when priority = 'p2' then created_at + interval '4 hours'
      when priority = 'p3' then created_at + interval '24 hours'
      else created_at + interval '4 hours'
    end
  ) stored;

create index if not exists ops_case_workflow_sla_due_idx on public.ops_case_workflow (sla_due_at);

