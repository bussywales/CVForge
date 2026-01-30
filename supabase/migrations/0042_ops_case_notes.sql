create table if not exists public.ops_case_notes (
  case_type text not null,
  case_key text not null,
  window_label text,
  checklist jsonb not null default '{}'::jsonb,
  outcome_code text,
  notes text,
  status text not null default 'open',
  last_handled_at timestamptz,
  last_handled_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (case_type, case_key)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ops_case_notes_case_type_chk'
  ) then
    alter table public.ops_case_notes
      add constraint ops_case_notes_case_type_chk
      check (case_type in ('request', 'user'));
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ops_case_notes_outcome_chk'
  ) then
    alter table public.ops_case_notes
      add constraint ops_case_notes_outcome_chk
      check (outcome_code in ('resolved','escalated','needs_more_info','false_alarm','training_only') or outcome_code is null);
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ops_case_notes_status_chk'
  ) then
    alter table public.ops_case_notes
      add constraint ops_case_notes_status_chk
      check (status in ('open','closed'));
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ops_case_notes_notes_len_chk'
  ) then
    alter table public.ops_case_notes
      add constraint ops_case_notes_notes_len_chk
      check (notes is null or char_length(notes) <= 1000);
  end if;
end $$;

create index if not exists ops_case_notes_case_key_idx on public.ops_case_notes (case_key);
create index if not exists ops_case_notes_updated_idx on public.ops_case_notes (updated_at desc);
create index if not exists ops_case_notes_status_idx on public.ops_case_notes (status, updated_at desc);

alter table public.ops_case_notes enable row level security;

create policy "ops case notes read ops" on public.ops_case_notes
  for select using (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  );

create policy "ops case notes insert ops" on public.ops_case_notes
  for insert with check (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  );

create policy "ops case notes update ops" on public.ops_case_notes
  for update using (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  )
  with check (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  );
