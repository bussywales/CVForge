# Runbook

## Magic link redirect wrong domain
Symptoms: users land on the wrong URL after email sign-in or loop back to /login.
Checks: confirm NEXT_PUBLIC_SITE_URL matches your deployed URL and Supabase Auth redirect allowlist includes /auth/callback.
Fix: update NEXT_PUBLIC_SITE_URL in env and add the correct redirect URL in Supabase Auth settings.

## Supabase migration conflicts
Symptoms: errors like "policy already exists" or "functions in index expression must be marked IMMUTABLE".
Checks: use supabase migration list to compare local vs remote history.
Fix: if a policy already exists, drop it manually or mark the migration as applied with supabase migration repair. For immutable index errors, avoid date_trunc in index expressions and store derived values in columns.

## DOCX export 500s
Symptoms: export routes return JSON error payloads with 500 status.
Checks: confirm nodejs runtime exports are set, docx is externalised in next.config.js, and required data exists in the autopack.
Fix: review Vercel logs for the error detail field, and re-run export locally.

## ZIP export issues
Symptoms: submission pack download fails or ZIP is empty.
Checks: ensure archiver is installed and the export route uses nodejs runtime with force-dynamic.
Fix: inspect Vercel logs, and confirm CV and cover letter content exist before exporting.

## Where to look
Vercel: Function logs for export/import routes and webhook processing.
Supabase: Logs for RLS rejections and SQL errors.
Env vars: check ENV.md and Vercel dashboard for missing keys.
