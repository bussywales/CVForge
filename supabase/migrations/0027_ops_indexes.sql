-- Ops/system performance indexes
create index if not exists idx_application_activities_type_occurred_at on public.application_activities (type, occurred_at desc);
create index if not exists idx_application_activities_user_occurred_at on public.application_activities (user_id, occurred_at desc);

create index if not exists idx_ops_audit_log_created_at on public.ops_audit_log (created_at desc);
create index if not exists idx_ops_audit_log_actor on public.ops_audit_log (actor_user_id, created_at desc);
create index if not exists idx_ops_audit_log_target on public.ops_audit_log (target_user_id, created_at desc);
