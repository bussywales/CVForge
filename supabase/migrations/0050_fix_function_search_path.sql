-- Fix Supabase DB linter: function_search_path_mutable
-- Postgres functions should have an explicit, immutable search_path to avoid role-based hijacking.
--
-- Note: some Postgres versions don't support `ALTER FUNCTION IF EXISTS`, so guard via to_regprocedure().

do $$
begin
  if to_regprocedure('public.set_referral_code_updated_at()') is not null then
    execute 'alter function public.set_referral_code_updated_at() set search_path = pg_catalog, public';
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.set_ops_alert_states_updated_at()') is not null then
    execute 'alter function public.set_ops_alert_states_updated_at() set search_path = pg_catalog, public';
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.ops_case_set_sla_due_at()') is not null then
    execute 'alter function public.ops_case_set_sla_due_at() set search_path = pg_catalog, public';
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    execute 'alter function public.set_updated_at() set search_path = pg_catalog, public';
  end if;
end
$$;
