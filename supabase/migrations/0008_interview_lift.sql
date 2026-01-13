alter table public.applications
  add column if not exists star_drafts jsonb not null default '[]'::jsonb,
  add column if not exists last_lift_action text,
  add column if not exists lift_completed_at timestamptz;

create index if not exists applications_user_lift_completed_idx
  on public.applications (user_id, lift_completed_at desc);
