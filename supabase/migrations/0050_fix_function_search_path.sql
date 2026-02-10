-- Fix Supabase DB linter: function_search_path_mutable
-- Postgres functions should have an explicit, immutable search_path to avoid role-based hijacking.

alter function if exists public.set_referral_code_updated_at()
  set search_path = pg_catalog, public;

alter function if exists public.set_ops_alert_states_updated_at()
  set search_path = pg_catalog, public;

alter function if exists public.ops_case_set_sla_due_at()
  set search_path = pg_catalog, public;

alter function if exists public.set_updated_at()
  set search_path = pg_catalog, public;

