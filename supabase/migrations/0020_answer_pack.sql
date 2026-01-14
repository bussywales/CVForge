create table if not exists public.interview_answer_pack (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  question_id uuid null,
  question_key text not null,
  question_type text not null,
  variant text not null default 'standard',
  star_gap_key text not null,
  star_library_id uuid not null references public.star_library (id) on delete cascade,
  answer_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interview_answer_pack_unique unique (
    user_id,
    application_id,
    question_key,
    variant
  )
);

create index if not exists interview_answer_pack_app_idx
  on public.interview_answer_pack (application_id);

create index if not exists interview_answer_pack_star_idx
  on public.interview_answer_pack (star_library_id);

alter table public.interview_answer_pack enable row level security;

create policy "Users can select their answer pack"
  on public.interview_answer_pack
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their answer pack"
  on public.interview_answer_pack
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their answer pack"
  on public.interview_answer_pack
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their answer pack"
  on public.interview_answer_pack
  for delete
  using (auth.uid() = user_id);

drop trigger if exists set_interview_answer_pack_updated_at on public.interview_answer_pack;

create trigger set_interview_answer_pack_updated_at
before update on public.interview_answer_pack
for each row
execute function public.set_updated_at();
