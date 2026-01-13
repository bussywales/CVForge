alter table public.applications
  add column if not exists contact_name text null,
  add column if not exists contact_role text null,
  add column if not exists contact_email text null,
  add column if not exists contact_linkedin text null,
  add column if not exists outreach_stage text not null default 'not_started',
  add column if not exists outreach_last_sent_at timestamptz null,
  add column if not exists outreach_next_due_at timestamptz null,
  add column if not exists outreach_channel_pref text not null default 'email';

create index if not exists applications_user_outreach_due_idx
  on public.applications (user_id, outreach_next_due_at);

create index if not exists applications_user_outreach_stage_idx
  on public.applications (user_id, outreach_stage);
