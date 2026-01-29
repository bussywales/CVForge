alter table public.ops_training_scenarios
  add column if not exists acknowledged_at timestamptz null,
  add column if not exists ack_request_id text null;
