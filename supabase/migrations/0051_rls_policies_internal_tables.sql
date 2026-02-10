-- Supabase linter: rls_enabled_no_policy
-- These tables are internal-only. Add explicit service_role policies (no broadening to end users).

do $$
begin
  if to_regclass('public.ops_alert_delivery') is not null then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'ops_alert_delivery'
        and policyname = 'ops alert delivery service role'
    ) then
      execute $pol$
        create policy "ops alert delivery service role"
          on public.ops_alert_delivery
          for all
          using (auth.role() = 'service_role')
          with check (auth.role() = 'service_role');
      $pol$;
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.stripe_events') is not null then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'stripe_events'
        and policyname = 'stripe events service role'
    ) then
      execute $pol$
        create policy "stripe events service role"
          on public.stripe_events
          for all
          using (auth.role() = 'service_role')
          with check (auth.role() = 'service_role');
      $pol$;
    end if;
  end if;
end
$$;

