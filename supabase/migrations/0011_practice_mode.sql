create table if not exists public.interview_practice_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  question_key text not null,
  question_text text not null,
  answer_text text not null default '',
  rubric_json jsonb not null default '{}'::jsonb,
  score int not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists interview_practice_answers_unique
  on public.interview_practice_answers (user_id, application_id, question_key);

create index if not exists interview_practice_answers_user_app_updated_idx
  on public.interview_practice_answers (user_id, application_id, updated_at desc);

alter table public.interview_practice_answers enable row level security;

create policy "Users can select their practice answers"
  on public.interview_practice_answers
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their practice answers"
  on public.interview_practice_answers
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their practice answers"
  on public.interview_practice_answers
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their practice answers"
  on public.interview_practice_answers
  for delete
  using (auth.uid() = user_id);
