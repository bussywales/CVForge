alter table public.applications
  add column if not exists job_text text,
  add column if not exists job_text_source text,
  add column if not exists job_fetched_at timestamptz,
  add column if not exists job_fetch_status text,
  add column if not exists job_fetch_error text,
  add column if not exists job_fetch_etag text,
  add column if not exists job_fetch_last_modified text,
  add column if not exists job_text_hash text,
  add column if not exists job_source_url text;
