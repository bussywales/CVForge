create table if not exists public.ops_case_queue (
  request_id text primary key references public.ops_case_workflow(request_id) on delete cascade,
  last_touched_at timestamptz not null default now(),
  reason_code text,
  reason_title text,
  reason_detail text,
  reason_primary_source text,
  reason_computed_at timestamptz,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ops_case_queue_reason_chk'
  ) then
    alter table public.ops_case_queue
      add constraint ops_case_queue_reason_chk
      check (
        reason_code in (
          'ALERT_FIRING',
          'ALERT_RECENT',
          'WEBHOOK_FAILURE',
          'BILLING_RECHECK',
          'PORTAL_ERROR',
          'RATE_LIMIT',
          'TRAINING',
          'MANUAL',
          'UNKNOWN'
        )
        or reason_code is null
      );
  end if;
end $$;

create index if not exists ops_case_queue_last_touched_idx on public.ops_case_queue (last_touched_at desc);
create index if not exists ops_case_queue_reason_idx on public.ops_case_queue (reason_code);

alter table public.ops_case_queue enable row level security;

create policy "ops case queue read ops" on public.ops_case_queue
  for select using (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  );

create policy "ops case queue insert ops" on public.ops_case_queue
  for insert with check (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  );

create policy "ops case queue update ops" on public.ops_case_queue
  for update using (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  )
  with check (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  );

create table if not exists public.ops_case_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id),
  request_id text not null,
  action text not null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists ops_case_audit_request_idx on public.ops_case_audit (request_id, created_at desc);

alter table public.ops_case_audit enable row level security;

create policy "ops case audit read ops" on public.ops_case_audit
  for select using (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  );

create policy "ops case audit insert ops" on public.ops_case_audit
  for insert with check (
    auth.uid() in (select user_id from public.user_roles where role in ('support','admin','super_admin'))
    or auth.role() = 'service_role'
  );
