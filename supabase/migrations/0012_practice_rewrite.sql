alter table public.interview_practice_answers
  add column if not exists improved_text text not null default '',
  add column if not exists improved_meta jsonb not null default '{}'::jsonb,
  add column if not exists improved_updated_at timestamptz null;
