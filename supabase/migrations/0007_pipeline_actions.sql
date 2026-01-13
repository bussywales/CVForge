alter table public.applications
  add column if not exists next_action_type text,
  add column if not exists next_action_due date,
  add column if not exists last_activity_at timestamptz;

create index if not exists applications_user_next_action_due_idx
  on public.applications (user_id, next_action_due);
