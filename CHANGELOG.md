# Changelog

## v0.7.17
- Smart Apply v2: compact header, collapsible checklist, and “Next 3 actions” with deep links to Apply/Interview/Activity tabs; anchors added for follow-up and Autopacks.

## v0.7.18
- Interview Conversion Loop v1: follow-up cadence helper, Follow-up Autopilot strip in Apply tab, outcomes on applications, and cadence/logging surfaced in pipeline Action Centre. Checklist stays collapsible and deep links respect tab anchors.

## v0.7.15-docs
- User Guide v1.2 rebuilt for non-technical users: quick path, clearer Evidence/exports guidance, troubleshooting table, and Optional AI Boost workflow.

## v0.7.14-docs
- CVForge User Guide v1.1 polish: added table of contents, refined workflows, mini-maps, and cross-links plus glossary guidance.

## v0.7.13
- Add deterministic detection of blocked job sources (Indeed & LinkedIn) and surface calm “Open & paste” guidance in the Job advert card when fetching is blocked.
- Job fetch API now returns `blocked` responses with reason/suggestedAction and logs `job.fetch_blocked` activities for blocked attempts.

## v0.7.12b
- Application detail tabs remember the last opened tab per application, show lightweight badges for pending work, and collapse the edit form for longer/up-to-date listings.
- CTAs now deep-link to the correct tabs (`?tab=...`) and the Overview tab stays compact while heavy panels remain lazy-loaded.

## v0.7.12a
- Application detail now uses tabbed navigation (Overview, Apply, Evidence, Interview, Activity, Admin/Debug) to prevent endless scrolling.
- Lazy loading per tab ensures Smart Apply, Autopacks, Role Fit, STAR Library, Interview Lift, and Activity panels render only when needed.

## v0.7.11
- Answer Pack generation from STAR drafts with Standard and 90-second variants.
- Drill Mode and Practice Dashboard show answer-ready states and apply flows.

## v0.7.10
- STAR Library drafts created from STAR-target evidence with per-gap editor pages.
- Practice Dashboard and Drill Mode surface STAR-ready drafts and allow paste-in.

## v0.7.9
- Evidence target toggles for CV/Cover/STAR with persisted selections.
- Autopack generation stores evidence traces and shows evidence used in the editor.

## v0.7.5
- Evidence Engine v1 with evidence suggestions on Role Fit gaps and one-click apply actions.
- Selected evidence stored per application and used during autopack generation.

## v0.7.6
- Evidence quality scoring with fuzzy matching across achievements and work history.
- Role Fit gaps now show quality-ranked evidence suggestions and fallback actions.

## v0.7.7
- Evidence suggestions now return selected flags for immediate UI feedback.
- Role Fit selections show Selected ✓ state with optimistic updates.

## v0.7.8
- Selected evidence now appears per gap with Copy and Unselect actions.
- Evidence suggest response includes selectedEvidence lists per gap.

## v0.7.4
- Job advert fetch endpoint with extracted snapshot storage and refresh support.
- Role Fit, Autopack, and Interview Pack now prefer fetched snapshots when available.

## v0.7.3
- Smart Apply panel with submission checklist, closing dates, and source platform fields.
- Auto-updated checklist from exports and a follow-up scheduler.

## v0.7.2
- Application Kit panel with checklist, readiness score, and next best actions.
- Application Kit ZIP export with CV, cover letter, interview pack, and STAR drafts.

## v0.7.1
- Practice Dashboard with scoring summary and question status per application.
- Drill Mode for one-by-one practice using existing scoring and rewrite flows.

## v0.7.0b
- Practice Mode Rewrite Coach with deterministic STAR rewrites and previews.
- Rewrite API endpoint plus stored improved drafts metadata.

## v0.7.0a
- Practice Mode for Interview Pack with deterministic scoring and saved drafts.
- Interview practice API endpoints and migration for stored answers.

## v0.6.9
- Interview Pack v1 on application detail pages (deterministic questions, prompts, and weak spots).
- Interview Pack DOCX export with Standard and ATS-Minimal variants.

## v0.6.8-docs
- Documentation hardening: architecture, database, API, runbooks, smoke tests, and release process.
- Standardised docs index and changelog structure.

## v0.6.7
- Work history table and Profile CRUD for roles.
- DOCX import detects Experience roles and can apply to work history.
- DOCX export includes Professional Experience for Standard and ATS-Minimal variants.

## v0.6.6
- Outreach Engine with deterministic templates and contact fields.
- Pipeline Action Centre integration with outreach logging and reminders.

## v0.6.5
- Submission Pack exports: Standard + ATS-Minimal DOCX and ZIP bundle.
- Export readiness checks and filename sanitisation.

## v0.6.4
- Interview Lift loop with deterministic next actions and STAR drafts.
- Lift scoring and action logging.

## v0.6.3
- Pipeline Action Centre for follow-up templates and activity logging.

## v0.6.2
- Pipeline tracking fields, activity log, and follow-up templates.
- Pipeline board and insights counters.

## v0.6.1
- Submission checklist, fallback evidence drafts, and metrics helper.
- Admin proposal edits for learning packs.

## v0.6.0
- Opt-in JD learning events and admin pack proposals.
- Published domain packs integrated into Role Fit.
