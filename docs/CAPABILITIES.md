# Capabilities

## Auth and sessions
Magic-link sign-in with Supabase, SSR session refresh, and a server-side auth callback at /auth/callback.

## Profile and evidence
Profiles store name, headline, and location. Achievements capture STAR evidence with optional metrics. Work history stores roles, dates, summaries, and bullet highlights.

## Applications
Applications capture job title, company, description, status, and optional job advert link. Tracking fields support follow-up dates, contacts, activity history, and outreach stages.

## Application detail tabs
The application detail page uses tabs (Overview, Apply, Evidence, Interview, Activity, Admin/Debug) so each workflow is easy to reach without scrolling endlessly. The tabs persist per application via localStorage, display lightweight badges for pending apply items, gaps, and activity follow-ups, and all CTA links include `?tab=` so they jump to the right workspace. The Overview tab collapses the edit form for longer or recently updated job descriptions while keeping the job advert card handy.

## Next Best Actions bar
A sticky “Next best actions” bar appears under the application tabs, showing up to three suggested steps with deep links to the right tab/section.

## Job Link Fetch v1
Job advert links can be fetched server-side to store a read-only snapshot. Role Fit, Autopacks, and Interview Packs prefer the fetched snapshot when available.
Some sites such as Indeed and LinkedIn block automated fetches, so the UI now surfaces a calm “Open advert and paste the text” path, and the API explicitly reports blocked sources with structured tips for manual paste.

## Autopacks
Autopacks generate CVs, cover letters, and STAR answers from profile and achievements. Users can edit and version outputs in-app.

## Role Fit and Interview Lift
Role Fit uses deterministic taxonomies, domain packs, and fallback JD terms to score coverage and suggest gaps. Interview Lift uses deterministic checks to recommend next actions and STAR drafts.

## Evidence Engine v1
Evidence Engine builds a tagged evidence bank from achievements and work history, suggests evidence for Role Fit gaps with quality scoring and fuzzy matching, and lets users attach evidence to STAR drafts or achievements.

## Interview Pack v1
Interview Pack builds a deterministic interview bundle from the job description, Role Fit signals, and Interview Lift actions, with questions, STAR prompts, weak spots, and a DOCX export.

## Practice Mode
Practice Mode adds per-question STAR drafting with deterministic scoring, recommendations, saved drafts per application, and a Rewrite Coach for improved STAR structure. A Practice Dashboard and Drill Mode help prioritise weak questions and practise one-by-one.

## STAR Library v1
STAR Library creates per-gap STAR drafts from STAR-target evidence, with editable fields and links into Drill Mode for practice.

## Answer Pack v1
Answer Pack generates deterministic interview answers from STAR drafts (Standard and 90-second variants), now shown in a compact accordion with per-answer copy and copy-all to avoid wall-of-text previews, and applies them into Practice drafts.

## Application Kit v1
Application Kit aggregates readiness checks, next best actions, and a ZIP download containing CV, cover letter, interview pack, and STAR drafts.

## Smart Apply v2
Smart Apply now uses a compact header (readiness, status, closing date, source) plus a “Next 3 actions” strip with tab deep links. The submission checklist is collapsible by default and remembers your preference per application. A Follow-up Autopilot strip suggests the next cadence step with copy/log/schedule controls, and outcomes (interview invite/rejected/offer) can be recorded. Exports, kit downloads, and follow-up scheduling still update the checklist automatically.

## Outcome Loop v1
Record outcomes with status/reason/notes, snapshot recent actions (evidence, outreach, practice, exports, kit), and surface lightweight insights. Pipeline cards show outcome chips and filters for active vs lost roles.

## Apply Kit Wizard v1
Guided path for non-technical users: job text readiness, evidence for gaps, STAR draft, download kit, then mark submitted and schedule follow-up with tab/anchor deep links.

## First Job Win onboarding
On /app/insights, a five-step onboarding card (import CV, add achievements, add work history, create application, run Apply Kit Wizard) plus a sample application shortcut for zero-data accounts.

## Insights Dashboard v1
Non-technical summary at /app/insights showing today’s top actions, a simple funnel (drafted/submitted/interview/offer/rejected/no response), response rate, and lightweight behavioural insights based on logged actions.

## Coach Mode (Insights)
Weekly targets (follow-ups, submissions, STAR drafts, practice), weakest-step detection, and one-click coach actions (schedule follow-up, create STAR draft, run Apply Kit Wizard) with friendly banners driven by query params.
Weekly Coach Plan (This Week) on Insights shows a deterministic 3–5 action plan with deep links, simple weekly targets, and logging to drive weekly retention for subscribed users.

## Pipeline and tracking
A pipeline board shows status lanes, next actions, and activity history. The Action Centre provides follow-up templates, activity logging, and calendar invite downloads.

## Outcome Loop
Outcome Loop v2 offers quick outcome logging (status/reason/note) embedded across Weekly Review, Outreach, and application overview, plus insights with top reasons and recommended next moves that feed into next-best actions.

## Outreach Engine
Deterministic outreach templates for email and LinkedIn, one-click logging, and automated next-outreach scheduling. Outreach panel on Activity tab plus an Outreach queue in Applications Command Centre for copy + log and deep-linking. Supports saved recruiter contact, one-click Gmail/LinkedIn send, reply triage, next-move recommendations, message variants with quality cues, and reply-rate insights.

## Interview Focus Session
Interview tab includes a guided Focus Session (15–25 mins) with prioritised questions, quality cues, Ready/Undo persistence per week, copy-all answers, and deep links into Answer Pack items.

## Offer & Negotiation Pack
When an offer is logged, the Offer Pack on Overview provides offer summary capture, counter builder, negotiation scripts (polite/direct/warm), and decision templates with copy buttons.
Decision logging updates outcomes and next best actions; accepted state includes “close other applications” templates.
Close-out loop after acceptance helps withdraw from other applications and log outcomes quickly.

## Ops Console
Ops/admin/super_admin roles see an Ops Console entry and can access /app/ops (others get a premium Access denied view with reference/support snippet). Ops support links deep-link into Billing sections (plan/pack/portal flows) with scroll/highlight for guided handoff.
Ops Case View: /app/ops/case provides a requestId-first cockpit with search + window selector, alerts/incidents/audits/webhooks/billing/resolution/watch panels, copyable case + handoff snippets, persistent checklist/notes/outcome tracking, training evidence copy, and canonical request context mapping (requestId → userId/email) with auto-resolve + confidence to unlock billing/dossier panels.
Ops Training sandbox includes ID copy actions (requestId/eventId/all) and Case View shortcuts for drill follow-through.

## Outreach Autopilot
Follow-up autopilot surfaces due/overdue follow-ups on Dashboard and Command Centre with one-tap send/log/schedule modal plus recovery cues.

## Imports and exports
DOCX import previews and applies profile fields, achievements, and work history. DOCX export supports Standard and ATS-Minimal variants plus a submission-pack ZIP.

## Billing and credits
Stripe Checkout is used for credit purchases, with a credit ledger and webhook-based crediting. Pack selector offers Starter/Pro/Power options and paywall CTAs appear at high-intent points (apply wizard, interview packs, answer packs). The Billing page now recommends a pack based on workload, shows ROI copy in gates, and threads return-to-action plus resume banners after checkout. Optional subscriptions + auto top-up preferences live in Billing; webhook grants monthly credits.
Top-up vs Subscription comparison cards highlight the recommended option with deterministic reasons across Billing and soft gates, using the same resume-aware checkout.
Stripe portal links use a dedicated /api/billing/portal endpoint with requestId-aware errors and masked logging so portal failures are observable to ops.
Portal failures surface banner retry links for users and trigger Ops Incident callouts for portal spikes; ops support actions include navigation-only portal open/retry links.
Billing guardrails: /app/billing shows a persistent status strip (subscription state, credits, last billing action, ops-support flag) with a copyable support snippet; portal_error query renders a premium banner with retry/dismiss + support snippet logging; reconciliation hint surfaces when checkout success hasn’t yet granted credits. Logging is non-blocking and sanitised.
Ops Incident Console shows a billing health mini-summary (portal/checkout/webhook counts across 24h/7d plus top codes) with filter chips; exports stay masked and no raw URLs are shown.
Ops billing triage (ops/admin): `/api/ops/billing/snapshot` returns masked Stripe + local billing signals with requestId; user dossier shows a refreshable Billing triage card with next-step guidance, focused billing/portal links, and optional Stripe dashboard shortcuts; billing-related incident groups link directly to triage.
Billing timeline + delay detector: /app/billing shows recent billing events (portal/checkout/webhook/credits) with support snippet copy and a credit-delay detector card; ops incidents add a webhook/credit trace summary with filter chips and masked counts.
Webhook health + recheck: deterministic helper surfaces healthy/delayed/degraded status with last ok/error + lag; /app/billing shows a webhook status badge and Billing timeline block with Re-check status (no navigation) plus masked billing trace snippet copy; new /api/billing/recheck returns status/timeline/webhook/delay with requestId + no-store. Ops Incident Console adds a webhook health callout with filter chips; ops dossier timeline tab shows recent billing events and a deep link to the billing trace anchor. Webhook status v2 is context-aware (not expected/watching/delayed/ok) and aligns with receipts + credits to avoid false alarms.
Webhook truth source v1: webhook badge uses neutral copy when credits exist or no checkout is expected, only warning on true delayed/failed signals; correlation row shows a confidence pill (healthy/unknown/delayed/failed) with the same data returned by /api/billing/recheck.
Ops System Status: ops-only /app/ops/status and API aggregate 24h billing/webhook/incident/audit counts, webhook queue repeats, deployment hints, and notes with refresh + auto-triage actions (deliveries, webhook tests, incidents/audits); outputs remain masked/no-store.
Billing correlation v2: deterministic helper correlates checkout→webhook→ledger signals, classifies delays (waiting_webhook/ledger/ui_stale/unknown), and surfaces correlation in Billing Trace with re-check CTA; ops incidents show delay bucket callout with filter chips; monetisation logs stay masked/non-blocking.
Recheck throttling + delay playbooks: /api/billing/recheck is rate-limited per user/IP with Retry-After; Billing Trace shows cooldown and delay playbook guidance with copyable snippets; ops/billing views include related incidents/audits deep-links for support with masked params.
Billing help prompt: /app/billing shows a dismissible “Did this help?” prompt with Yes/No flows, support snippet copy, and portal retry link to reduce support load; logging remains non-blocking and sanitised.
Ops Resolution card: Incident Console and user dossier Billing triage surface an Ops Resolution card for billing/requestId contexts with outcome select, deterministic customer reply copy/regenerate, support snippet copy, and masked ops links; logging is best-effort and sanitised.
Resolution outcomes loop: Ops can save structured billing resolution outcomes (enum codes + optional note) tied to requestId/userId via ops API; Incidents and dossier show recent outcomes inline to reduce repeat triage; logging/allowlists remain masked and non-blocking.
Resolution analytics & watchlist: /app/ops/resolutions provides masked outcome analytics with filters/exports plus a Due reviews tab (yes/no/later follow-ups, insights); watchlist API + UI tracks delayed/webhook cases (ResolutionCard, Incidents, dossier); playbooks suppress only when a recent successful outcome exists (failed attempts show a hint). Webhook failures queue at /app/ops/webhooks lists Stripe webhook errors with masked refs, filters, and exports.

## Monetisation analytics
Credit gates, checkout starts/successes, resume clicks, and autopack completions are logged deterministically. Insights shows a revenue funnel (7d/30d) plus top surfaces for gates and billing clicks to spot leaks quickly.
Recovery tile tracks checkout started/returned/completed and shows conversion hints to reduce drop-off; completion events are standardised across Autopack, Interview Pack export, Application Kit download, and Answer Pack generation.

## Marketing site
A public landing page explains the 20-minute flow (job advert → evidence → STAR → kit → submit), shows product tour cards, transparent pricing teaser, FAQ, and an optional AI Boost note. CTAs deep-link to signup/login or billing depending on auth.

## Dashboard v2
Signed-in users land on the Activation Command Centre: greeting with credits, top next-best actions, a compact active applications list with deep links into tabs/anchors, a coach nudge, and a funnel snapshot with response rate and a shortcut to Insights.

## Activation guidance
A compact Activation card on the dashboard shows deterministic first-value steps (add app, outreach, follow-up, outcome, interview/keep momentum) with progress, deduped next-best CTA, non-blocking logging, and ErrorBanner fallback; CTAs always target the newest active application with create-first-app fallback when none exist, and logging meta is sanitised/deduped. Dashboard actions are ranked and deduped with activation steps first.
Ops can view aggregated activation funnel metrics (views, clicks, completion, milestones) at `/app/ops/activation`, masked and read-only.

## Keep Momentum
A weekly Keep Momentum card surfaces one deterministic move (follow-up, outcome, interview prep, evidence, or pipeline review) with skip-for-week, secondary fallback, empty-state create-application CTA when no apps exist, and a fallback deep-link to the newest active app overview. Logging is masked/sanitised, deduped per week, and never blocks the CTA; ops activation funnel shows aggregated keep-momentum signals.

## Paywalls and resume
Credit gating is consistent across Autopacks, Interview Pack exports, Application Kit downloads, and Answer Pack generation. If credits are 0 you’re routed to billing with a saved return link; returning with `resume=1` shows a Resume Accelerator banner with a short countdown that auto-resumes the blocked action on the right tab/anchor (never auto-spends).

## Referrals
Shareable referral link gives +3 credits to inviter and invitee once on signup; redeeming is idempotent and self-referrals are blocked.

## Admin learning
Opt-in, anonymised JD learning events feed admin-reviewed domain pack proposals that can be published globally.

## Ops/Support
Ops Command Centre at `/app/ops` (env-guarded) lets support staff search users, view billing/credits/app snapshots, and open read-only dossiers at `/app/ops/users/:id` covering billing, outreach, outcomes, and next actions.
Ops Help/Runbook at `/app/ops/help` provides an ops-only playbook with sticky TOC, search, copyable section links, and a release discipline gate tied to RUNBOOK_META vs CHANGELOG.
Ops Training v1 extends the runbook with drills, quick cards, and escalation templates (copyable) plus print view for handoffs and training.
Ops Training sandbox v1 adds an ops-only scenario generator with safe test alert creation, a recent scenarios list, and deep links into Alerts/Incidents/Status for hands-on drills.
Ops Training reports add copyable scenario summaries with prefilled drill links and ACK state tracking for consistent handoffs.
Ops Alerts training deep links now avoid history API loops while still focusing and polling for the target event.
Support actions (v0.7.87): ops dossier adds manual credit adjustments (admin+ only, bounded), support link generator (billing compare/sub/pack or specific app tabs with from=ops_support), and a recent ops audit list with requestId references.
Support link generation is resilient to logging/copy failures; URL always renders with last-generated timestamp and manual copy hint if clipboard is blocked. Monetisation logging now fails softly (ok:false) instead of 500s.
Observability: key flows return request IDs with premium error banners plus copyable support snippets; Sentry capture uses the same references for faster debugging.
Ops Alerts actionability: alert actions deep-link to Incidents with window=15m/from=ops_alerts/signal/surface/code, test alerts persist masked is_test events with audits/incidents links, alerts can be marked handled via alert_handled outcomes (requestId optional) with badges + cooldown, Send test alert is deduped with a 10s cooldown timer, post-send polling surfaces new test events, Recent tab selection persists with auto-refresh on switch and per-tab last-loaded timestamps, webhook notifications support eventId + ack endpoint for marking handled from Slack/Teams, delivery receipts (sent/delivered/failed) surface in UI with a webhook config truth panel plus webhook test + Deliveries visibility, and UI-first Acknowledge buttons (plus copyable ACK link/curl) complete the loop without a terminal using short-lived signed tokens with ACK state synced across tabs.
Env: ALERTS_ACK_SECRET (required for signed ACK), ALERTS_ACK_TTL_SECONDS optional (10–30 minutes, defaults 15m).
Ops alert workflow: ops can claim/release/snooze alerts (30m claim TTL; 1h/24h snooze), add masked handoff notes, and see ownership/snooze state inline; workflow APIs are ops-only with requestId/no-store and masked logging.
Incident Console (v0.7.82) lets ops look up Reference IDs and browse recent incidents (billing/checkout/portal/outcomes) with masked user info and support snippets.
v0.7.84 extends requestId + structured error coverage across remaining APIs and surfaces, making support handoff consistent.
Incident Console v2 (v0.7.85) adds grouped feeds, filters, related timelines, and CSV/JSON export for ops with no secrets exposed.
Support links now deep-link into Billing sections (subscription/packs/portal-return) with scroll + highlight when `support=1` or `from=ops_support`.
Deeplink handler retries until anchors exist and logs attempt/applied/missing events for ops debugging.
Ops Audits (v0.7.99): ops-only audits page at `/app/ops/audits` lists masked audit entries with filters (user/actor/action/date/q), cursor pagination, JSON/CSV export, and dossier deep-linking; API is RBAC-guarded with structured errors and hashed search logging.
Ops correlation (v0.8.00): audits and incidents cross-link via requestId with support bundles (masked actor/target/meta), billing-first next actions, quick filters, and masked exports.
Incident Playbooks (v0.8.01): deterministic billing/Stripe playbooks suggest likely causes, next steps, safe deeplinks (billing/dossier/support link), and premium customer reply templates; outputs stay masked and ops-only.

## Reliability and limits
Load & Limits Pack v1 (v0.8.24): shared in-memory rate limiter wraps billing recheck, monetisation log, and ops actions (resolution outcome/effectiveness/watch/system status) with consistent x-request-id + no-store + Retry-After headers. Billing/ops UIs show calm cooldown or inline rate-limit messages without losing prior state. Ops System Status exposes a Limits panel (approximate hits and top routes) with masked deep links to audits/incidents for pressure triage.
Ops RAG status v1 (v0.8.25): deterministic 15-minute RAG helper + API feeds Ops Status and Command Centre badges with masked reason chips and quick actions into webhook failures/incidents/rate-limit panels.
Ops RAG drill-down v2 (v0.8.26): shared rag helper + /api/ops/rag-status expose masked signals (counts, top codes/surfaces, first seen), headline, and 24h trend (15m buckets, health score, direction) with Ops Status showing “Why this status” actions and deep links into incidents/webhooks.
Early Access + Ops repeats (v0.8.27): invite-gated dashboard/billing/applications with calm Early Access page; central rate-limit budgets with 429 meta; Ops Status adds Top repeats (15m) with masked requestId/code/surface deep links and watch shortcuts while panels preserve last good state under 429/5xx.
Ops Early Access allowlist (v0.8.28): ops-managed allowlist table with grant/revoke + notes, ops APIs + /app/ops/access console; gate reads DB first with env fallback, logging/audit-friendly and masked.
Ops Alerts v1 (v0.8.29): deterministic 15m alerting (RAG red, webhook/portal spikes, rate-limit pressure) with persisted state/events, webhook notify, Ops alerts page (firing/recent) and actionable deep links.
Early Access invites v1 (v0.8.31): ops can create/revoke email-hash invites pre-signup with copyable links/instructions and recent invite history; gate auto-claims invites on signup/login (hashed email only) before env fallback, with masked logging and budgets.
Onboarding funnel v1 (v0.8.32): deterministic onboarding steps (CV created/exported, application added, optional interview) with DB persistence, skip-for-week, dashboard “Getting started” card, and calm empty states guiding first value; telemetry is masked and deduped.
Invite attribution + funnel (v0.8.33): invite tokens claim to profiles with masked hashes, ops can copy invite templates (email/WhatsApp/SMS/DM), and ops funnel API/panel shows 24h/7d invite→first-value counts with rate-limited refresh and sanitised telemetry.
Invite landing + funnel drill-down (v0.8.34a): public invite page stores tokens pre-auth, post-login auto-claim banner with retry, ops funnel grouped by source, and dossiers show invite attribution links.
Invite alerts hardening (v0.8.34b): Ops Alerts uses safe JSON fetch, calm empty/error states with requestId, preserves last-good data on refresh failures, and adds alerts load error telemetry.
Invite conversion booster + alerts polish (v0.8.35/35a): invite landing benefits/invalid handling, auto-claim success banner with CV CTA, ops funnel filters (window/source/include unknown) with shareable links, and Ops Alerts resilient to non-JSON/partial responses with coerced models, trustworthy load state, last-checked timestamp, and calm webhook note.

## Deterministic vs OpenAI usage
Deterministic engines include role-fit.ts, interview-lift.ts, outreach-templates.ts, submission-quality.ts, and metrics-helper.ts. OpenAI is only used for autopack generation via server-side API calls.

## Non-goals / Not supported
No PDF export. No automated job advert scraping beyond user-initiated fetch and text extraction. No auto-apply or multi-user workspaces. No email sending or messaging integrations. No storage of raw job descriptions for learning.
