# Database

## Tables

### profiles
Purpose: profile identity for each user.
Key fields: user_id, full_name, headline, location, telemetry_opt_in.
RLS: user_id = auth.uid().

### achievements
Purpose: evidence bank for STAR content.
Key fields: title, situation, task, action, result, metrics.
RLS: user_id = auth.uid().

### work_history
Purpose: employment history for DOCX export and profile display.
Key fields: job_title, company, start_date, end_date, is_current, bullets.
RLS: user_id = auth.uid().

### applications
Purpose: job applications with tracking, outreach, and interview lift state.
Key fields: job_title, company, job_description, job_text, job_text_source, job_fetched_at, job_fetch_status, job_url, selected_evidence, applied_at, closing_date, submitted_at, source_platform, next_followup_at, next_action_due, outreach_stage, star_drafts.
RLS: user_id = auth.uid().

### application_evidence
Purpose: selected evidence per gap with match and quality metadata.
Key fields: application_id, gap_key, evidence_id, source_type, source_id, match_score, quality_score, use_cv, use_cover, use_star.
RLS: user_id = auth.uid().

### star_library
Purpose: per-application STAR drafts derived from evidence.
Key fields: application_id, gap_key, title, situation, task, action, result, evidence_ids, quality_hint.
RLS: user_id = auth.uid().

### application_apply_checklist
Purpose: submission checklist timestamps for Smart Apply.
Key fields: cv_exported_at, cover_exported_at, interview_pack_exported_at, kit_downloaded_at, outreach_step1_logged_at, followup_scheduled_at, submitted_logged_at.
RLS: user_id = auth.uid().

### application_activities
Purpose: timeline of application-related actions.
Key fields: type, channel, subject, body, occurred_at.
RLS: user_id = auth.uid().

### interview_practice_answers
Purpose: saved Interview Pack practice answers with rubric scoring.
Key fields: application_id, question_key, answer_text, rubric_json, score.
RLS: user_id = auth.uid().

### interview_answer_pack
Purpose: deterministic interview answers generated from STAR drafts.
Key fields: application_id, question_key, question_type, variant, star_gap_key, star_library_id, answer_text.
RLS: user_id = auth.uid().

### autopacks
Purpose: generated CV/cover letter drafts and STAR answers.
Key fields: application_id, version, cv_text, cover_letter, answers_json, evidence_trace.
RLS: user_id = auth.uid().

### audit_log
Purpose: operational audit trail (imports, generation, credits).
Key fields: action, meta.
RLS: user_id = auth.uid().

### credit_ledger
Purpose: credit balance ledger.
Key fields: delta, reason, ref.
RLS: user_id = auth.uid(), but webhook and deductions use service role.

### stripe_customers
Purpose: mapping between users and Stripe customer IDs.
Key fields: stripe_customer_id.
RLS: user_id = auth.uid(), service role writes.

### stripe_events
Purpose: Stripe webhook idempotency.
Key fields: id, type.
RLS: enabled; writes are service role only.

### role_fit_learning_events
Purpose: opt-in, anonymised JD learning events.
Key fields: domain_guess, matched_signals, missing_signals, top_terms, created_day.
RLS: insert/select allowed for user when telemetry_opt_in is true.

### domain_pack_proposals
Purpose: admin-reviewed domain pack proposals.
Key fields: domain_guess, title, signals, source_terms, occurrences, status.
RLS: insert allowed for opt-in users; reads are admin/service role only.

### domain_packs
Purpose: published Role Fit packs.
Key fields: slug, title, version, is_active, pack.
RLS: authenticated users can select active packs; admin writes via service role.

## Migration ledger (apply order)
- 0001_init: baseline tables, RLS, and profile trigger.
- 0002_job_url: add applications.job_url.
- 0003_learning_events: telemetry_opt_in and role_fit_learning_events.
- 0004_domain_packs: domain pack proposals and published packs.
- 0005_application_tracking: tracking fields and status defaults.
- 0006_application_activities: activity log table.
- 0007_pipeline_actions: next_action fields for pipeline reminders.
- 0008_interview_lift: star_drafts and lift metadata.
- 0009_outreach: outreach stages and contact fields.
- 0010_work_history: work_history table and updated_at trigger.
- 0011_practice_mode: interview_practice_answers for practice drafts and scoring.
- 0012_practice_rewrite: improved_text and metadata for practice drafts.
- 0013_smart_apply: closing_date/source_platform/submitted_at and apply checklist table.
- 0014_job_fetch: job advert snapshot fields for fetched job text.
- 0015_evidence_engine: selected_evidence storage on applications.
- 0016_evidence_quality: application_evidence table with match and quality metadata.
- 0017_evidence_targets: CV/Cover/STAR target flags on application_evidence.
- 0018_autopack_evidence_trace: evidence_trace on autopacks.
- 0019_star_library: STAR Library drafts per application.
- 0020_answer_pack: interview_answer_pack storage for deterministic answers.

## Common migration issues
- Policy already exists: drop the policy or use supabase migration repair to mark it applied.
- Immutable index errors: avoid expressions like date_trunc in indexes; store derived values in columns.
- RLS blocking writes: use the service role for webhook or admin writes, not the user session.
