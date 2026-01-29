create table if not exists public.ops_request_context (
  request_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  email_masked text,
  sources text[] not null default '{}'::text[],
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_seen_path text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists ops_request_context_user_id_idx on public.ops_request_context (user_id);
create index if not exists ops_request_context_last_seen_idx on public.ops_request_context (last_seen_at desc);

alter table public.ops_request_context enable row level security;

create policy "ops request context read ops" on public.ops_request_context
  for select using (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  );

create policy "ops request context insert service" on public.ops_request_context
  for insert with check (auth.role() = 'service_role');

create policy "ops request context update service" on public.ops_request_context
  for update using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
