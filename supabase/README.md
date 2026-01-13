# Supabase Migrations

Apply migrations in order using the Supabase SQL editor.

## Apply the migration
1. Open your project in the Supabase dashboard.
2. Navigate to **SQL Editor**.
3. Create a new query.
4. Copy each migration file into the editor and run in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_job_url.sql`
   - `supabase/migrations/0003_learning_events.sql`
   - `supabase/migrations/0004_domain_packs.sql`
   - `supabase/migrations/0005_application_tracking.sql`
   - `supabase/migrations/0006_application_activities.sql`
   - `supabase/migrations/0007_pipeline_actions.sql`

These create the tables, RLS policies, and the `handle_new_user` trigger plus Role Fit learning tables.
