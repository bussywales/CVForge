# Supabase Migrations (Phase 0)

Phase 0 uses a single SQL migration that you can run directly in the Supabase SQL editor.

## Apply the migration
1. Open your project in the Supabase dashboard.
2. Navigate to **SQL Editor**.
3. Create a new query.
4. Copy the contents of `supabase/migrations/0001_init.sql` into the editor.
5. Run the query.

This will create the tables, RLS policies, and the `handle_new_user` trigger.
