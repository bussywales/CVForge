# Changelog

## v0.7.49
- Subscription checkout now triggers the same Resume Accelerator as credit top-ups: success detects subscription returns, shows a subscription-specific banner, and auto-resumes pending actions with resume=1.
- Added subscription post-purchase logging events and completion watchdog hooks, plus a resume URL helper test.

## v0.7.48b
- Added a subscription nudge inside credit gates (Autopack, Interview Pack, Application Kit, Answer Pack) with plan availability guard, inline errors, and monetisation logging.
- Subscription gate CTA respects pending-action return links with `resume=1` and hides quietly when dismissed.

## v0.7.48a-hotfix
- Stabilised Vitest in sandbox/CI by running tests single-threaded; documented local vs CI commands.

## v0.7.48a
- Billing page now shows a subscription recommendation card under the hero with deterministic copy, Stripe checkout, and manage-portal access when subscribed.
- Subscription CTAs disable when plan price IDs are missing with clear helper text and logging; checkout failures surface inline retry/dismiss with monetisation events.
- Added a small subscription reco unit test and updated smoke tests for billing subscription flows.

## v0.7.45-hotfix
- Guard Stripe checkout when price IDs are missing or mode is invalid, returning explicit JSON errors instead of silent failures.
- Disable unavailable packs in billing/resume surfaces with helper text and logging, plus inline checkout failure banners with retry/dismiss.
- Document required Stripe pack/subscription env vars and site URL; update env example for hotfix rollout.

## v0.7.46
- Standardised completion events for Autopack generation, Interview Pack export, Application Kit download, and Answer Pack generation with a shared helper.
- Added checkout recovery: inline retry/help when redirects fail, completion watchdog after purchase returns, and credits-idle nudges on dashboard/command centre.
- Insights now shows a Recovery tile (checkout started → returned → completed) with conversion hints; monetisation logging allowlist extended for new events.

## v0.7.44
- Resume Accelerator: returning with `resume=1` and a saved pending action now shows a neutral success banner with a 3s countdown, auto-navigates to the saved tab/anchor, and triggers the pending action without extra clicks.
- Billing return links now append `resume=1` for all gated actions so resume flows kick in automatically while keeping monetisation logging intact and avoiding payment-specific copy.
- Completion nudges now auto-dismiss shortly after the resumed action finishes to keep the UI calm.

## v0.7.43
- Applications Command Centre: queue view with next-action CTA, readiness score, follow-up badges, filters/tabs, and search/sort by urgency.

## v0.7.42
- Post-purchase completion nudges: success banner renders on billing and application surfaces with session guard; resume completion events/logs extended to new flows.

## v0.7.40
- Billing hero simplification: single recommended decision card with dominant CTA, concise proof chips, and lighter secondary packs.

## v0.7.37
- Billing UX uplift: single hero recommendation with clear reasons, de-emphasised alternate packs, cleaner balance/usage, and polished referral copy icon layout.

## v0.7.36
- Billing conversion lift: personalised pack recommendation, ROI copy in gates, referral hint, and low-credit nudges with return-to-action checkout/resume.
- Credit gate/resume logging extended (billing viewed/return, pack recommended, resume dismiss).

## v0.7.32
- Revenue Funnel Analytics v1: monetisation event logging, checkout/gate/resume tracking, and a funnel panel on Insights using the shared helper.
- Fixed monetisation logging API parsing and aligned gating/resume flows to log events consistently.

## v0.7.34
- Dashboard v2 “Activation Command Centre”: greeting with credits, top actions, compact active applications list, coach nudge, and funnel snapshot with deep links into application tabs/anchors.

## v0.7.35
- Paywall consistency: Interview Pack export, Application Kit download, and Answer Pack generation now use the same credit gate + billing return flow with pending-action resume banners.
- Return-to-action preserved across checkout; resume banners trigger the blocked action with one click and log monetisation events.

## v0.7.33
- Marketing landing page rebuilt for conversion: clear 20-minute flow, product tour, transparent “does/doesn’t” section, pricing teaser, FAQ, and optional AI Boost note with CTA routing for signed-in vs new users.

## v0.7.30
- Action gating v1: Autopack generation shows a credit confirm modal when balance > 0 and a billing CTA when balance is 0.
- Referral copy UX: copy-icon button with quick feedback on Billing/Insights referral links.

## v0.7.29
- Referral Credits v1: shareable referral codes, idempotent +3 credits to inviter/invitee on signup, self-referral block, and billing/insights CTA surfaces.

## v0.7.28
- Subscription + auto-top-up v1: billing settings table, subscription checkout support, portal link, and auto top-up preferences with banners when credits are low.
- Pack model expanded with Starter/Pro/Power and subscription plan mapping; checkout and webhook now handle subscriptions and monthly credit grants.

## v0.7.27
- Billing polish: pack selector (Starter/Pro/Power) with Stripe price mapping, ROI panel, and pack CTAs across apply/interview/insights when credits are low.
- Checkout endpoint now accepts pack keys and return URLs for smooth post-purchase banners.

## v0.7.25
- Insights “Coach Mode” with weekly targets, weakest-step detector, and one-click actions (schedule follow-up, create STAR draft, jump to Apply Kit Wizard).
- Fixes to insights/coach actions to avoid server-side errors and ensure coach banners respect query params.

## v0.7.24
- First Job Win onboarding card on /app/insights with 5 guided steps (import CV, achievements, work history, application, Apply Kit Wizard).
- Added schema drift guard for applications queries (wildcard select) to avoid server render errors while schema stabilises.

## v0.7.22
- Apply Kit Wizard v1: guided steps (job text → evidence → STAR → kit → submit) with deep links across Overview/Apply, readiness states, and quick submit/follow-up controls.

## v0.7.23
- Insights Dashboard v1: new /app/insights page with Today’s top actions, a simple funnel (drafted → submitted → interview → offer/rejected/no response), response rate, and lightweight behaviour insights using logged actions.

## v0.7.21
- Outcome Loop v1: record outcomes with status/reason/notes, capture action snapshots, surface simple insights, and show outcome chips/filters in pipeline and application detail.

## v0.7.17
- Smart Apply v2: compact header, collapsible checklist, and “Next 3 actions” with deep links to Apply/Interview/Activity tabs; anchors added for follow-up and Autopacks.

## v0.7.18
- Interview Conversion Loop v1: follow-up cadence helper, Follow-up Autopilot strip in Apply tab, outcomes on applications, and cadence/logging surfaced in pipeline Action Centre. Checklist stays collapsible and deep links respect tab anchors.

## v0.7.19
- Answer Pack UX v1: accordion-style answers with per-row copy, copy-all, 90-second-first view, readiness badges, and a compact panel to avoid wall-of-text output.

## v0.7.20
- Tab UX polish: sticky “Next best actions” bar with tab/anchor deep links, per-application collapsed state, and anchors added across Apply/Evidence/Interview/Activity for consistent navigation.

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
