# Changelog

# Changelog
# Changelog

## v0.8.47
- Ops Alerts UX polish: post-send polling to surface new test events, per-tab last-loaded timestamps, and ACK cache reconciliation across tabs with a background refresh after acknowledgement.

## v0.8.46
- Ops Alerts UI consistency: Recent tab selection persists via query params, switching to Recent auto-refreshes the latest alert events, Send test alert jumps to Recent with the Test events panel open, and ACKed rows stay acknowledged after refresh with server rehydration.

## v0.8.43
- UI-first Alerts ACK: Ops Alerts page adds Acknowledge + Copy ACK link (curl optional) for firing/test events with badges and calm hints; ACK uses ops token mint + public ack flow with safe logging/guardrails and suppresses repeat ACKs.

## v0.8.42
- Configurable ACK TTL: ops ack-token route reads ALERTS_ACK_TTL_SECONDS (clamped 10–30m, default 15m), returns ttlSeconds, and logs mint success/error while preserving requestId/jsonError/no-store behaviours.

## v0.8.41
- Alerts delivery receipts: webhook notifications record sent/delivered/failed receipts per event and surface delivery badges with copyable refs/support snippets; webhook configuration now uses a deterministic helper with calm disabled hint.
- Signed ACK: ops can mint short-lived ACK tokens and webhook payloads include an ackUrl; public /api/alerts/ack verifies tokens to mark handled (deduped) without login; delivery/ack logging and allowlists added.

## v0.8.40
- Ops Alerts webhook ACK: webhook notifications now include eventId and ack deep link; new ops-only /api/ops/alerts/ack dedupes and records handled with masked actor/source; UI shows handled badges (UI/Slack/etc.), disables duplicate handle, and offers Copy ACK curl; notify logs added.

## v0.8.39
- Ops Alerts test sends are deduped within 10s (server-side) and the Send test alert button now shows a 10s cooldown countdown after success, auto-expands Test events as before, and stays enabled when a send fails; new telemetry added for send/cooldown/dedupe.

## v0.8.38
- Ops Alerts test UX: sending a test alert now auto-expands the Test events panel, shows a calm success hint, and scrolls into view when possible while keeping failures collapsed with the existing error banner.

## v0.8.36
- Ops Alerts actionability: incident deep links carry window/signal/surface/code/from=ops_alerts, “Mark handled” saves alert_handled outcomes (cooldown badge) with nullable requestId, and new allowlisted handled/test events.
- Testable alerts: /api/ops/alerts/test persists masked is_test events (window_label=test) returning eventId; Alerts UI adds collapsible Test events with audits/incidents links.
- Incidents console: empty filtered state shows widen chips (remove code/surface, 24h, clear all) with query updates + logging; “From Alerts” banner logs a view with back link.
- Logging/guardrails: allowlists and dedupe updated for widen/from-alerts/test/handled events; resolution outcomes accept alert_handled without requestId.

## v0.8.37
- Ops alert workflow v1: claim/release/snooze/unsnooze APIs with 15m workflow map, 30m claim TTL, masked handoff notes, and server helpers; new migrations for ownership/snoozes tables.
- Alerts UI: claim/release buttons, snooze/unsnooze controls (1h/24h), handoff note input, claimed/snoozed badges/expiry, and resilient workflow fetch with logging on failure.
- Incidents banner: From Alerts banner optionally notes claimed=me filter when deep-linked; actions append claimed=me for owned alerts.
- Logging/allowlists extended for claim/release/snooze/unsnooze/workflow/handoff events; new tests for helpers, workflow route, and UI workflow states.

## v0.8.35
- Ops Alerts polish: load state semantics prevent false “unavailable”, last-checked timestamp always shown, webhook note is informational with setup link, and model coercion keeps arrays safe.
- Invite conversion booster: polished invite landing with benefits, invalid-state support snippet, and signed-in claim CTA with calm copy.
- Post-claim UX: auto-claim success banner with CV CTA, retry banner gains “why” help, and extra logging/guardrails.
- Ops funnel filters: API supports window/source/includeUnknown, UI adds filters + copyable deep links, and ops access links to funnel by source.

## v0.8.35a
- Docs-only release metadata for the already shipped alerts availability polish.
- Alerts models coerced safely (no crash on missing fields) with safe refresh/test handling for non-JSON/partial payloads.
- Header semantics show real state with last-checked timestamp; calm empty state when no alerts.
- Webhook note is informational with setup link; short time formatter added.
- Logging allowlists updated and tests added in prior code; this tag records the release without new code changes.

## v0.8.34b
- Ops Alerts hardened against non-JSON responses: safe fetch/json helper, guarded parsing on initial load/refresh/test, and calm empty/error states with requestId.
- New empty state when no alerts firing or recent; last-good data preserved on refresh failures.
- Logging allowlist expanded for alerts load errors; docs/smoke updated.

## v0.8.31
- Early access invites v1: email-hash invites table + helper to create/list/revoke/claim; gate auto-claims on signup/login using hashed email with no raw addresses logged.
- Ops Access console adds invite flow for emails without accounts: create/revoke endpoints with budgets, copyable invite links/instructions, invite status badges, and recent invites list.
- Logging/allowlists updated for invite search/create/revoke/claim events; docs/runbook refreshed and migrations aligned with email-hash primary keys.

## v0.8.32
- Onboarding funnel v1: deterministic onboarding model with auto-completed steps (CV created/exported, application added, optional interview) persisted in DB; skip-for-week support and logs.
- Dashboard Getting started card with premium CTAs, skip/dismiss handling, and calm empty states across Applications/Profile (CV) and Interviews.
- New onboarding APIs with rate limits, sanitised telemetry events, and docs/smoke tests for first-value flow updates.

## v0.8.33
- Invite attribution + templates: invite claim route with masked attribution on profiles, token storage from signup/login, ops access templates (email/WhatsApp/SMS/DM) and copy logging.
- Ops funnel counters: new ops API + Command Centre panel showing 24h/7d invited→signup→CV→export→application→interview counts with conversions and cooldown handling.
- Logging/allowlists/rate-limit budgets expanded for invite attribution, funnel, and template copy; docs and smoke tests updated.

## v0.8.34a
- Invite landing page storing tokens pre-auth with Continue CTA; post-login auto-claim banner with retry/copy/dismiss and dedupe.
- Ops funnel supports grouping by source with dedicated /app/ops/funnel page; user dossier shows invite attribution when present.
- Logging/allowlists updated for landing, claim banner, funnel group-by-source, and dossier attribution.

## v0.8.30
- Early Access email invites: allowlist supports email-only invites with hashed emails, optional user linkage, and unique active entries; ops can grant/revoke pre-signup and gate checks DB by user or email hash before env fallback.
- Ops Early Access console updated for invite flow with user-found status, invite status, copyable instructions, and email-based grant/revoke; new helper for invite instructions and gate logging.

## v0.8.29
- Ops Alerts v1: deterministic 15m alert model (RAG red, webhook/portal spikes, rate-limit pressure) with stored state/events, webhook notifier, and actionable links.
- Ops Alerts API + UI: /api/ops/alerts (with test hook) and /app/ops/alerts page showing firing/recent alerts, refresh/test controls, deep links, and webhook configuration note.
- New alert tables with RLS, rate-limit budgets, logging allowlists, and early access invite runbook docs added.

## v0.8.28
- Ops Early Access allowlist: new DB table with grant/revoke/audit fields + RLS; ops APIs to lookup/grant/revoke with budgets/requestId/no-store and idempotent writes.
- Early access gate now checks DB first then env fallback; Early Access page shows reason; ops can manage access via new /app/ops/access console with lookup, status, and noteable grant/revoke actions.
- Logging/allowlists expanded for access events; docs + smoke steps updated.

## v0.8.27
- Early access gating for dashboard/billing/applications: ops bypass, invite list via EARLY_ACCESS_EMAILS, calm Early Access page with support snippet + logging.
- Rate limit budgets centralised per route with 429 meta; ops/billing routes now share budgets; ops panels show cooldowns while keeping last good state.
- Ops Status adds Top repeats (15m) card with deep links + watch shortcut; RAG model carries masked repeats/trend; Ops/Webhooks panels log rate-limit/fetch errors.

## v0.8.26
- Ops RAG v2: deterministic helper with masked signals (counts, top codes/surfaces, first seen), headline, and 24h trend (96 buckets, health score, direction) driven by existing incident/webhook/rate-limit data; shared across /api/ops/system-status and /api/ops/rag-status.
- Ops Status UI gains “Why this status” drill-down with per-signal actions, 15m deep links to webhooks/incidents, and a 24h trend strip with improving/stable/worsening direction + calm error/rate-limit handling.
- Webhooks/Incidents accept window=15m + signal/code params for deep links; monetisation allowlists expanded for new RAG drill-down/trend events.

## v0.8.25
- Ops RAG status: deterministic 15-minute RAG helper with webhook/portal/checkout/rate-limit thresholds and reasons.
- New ops API + status page strip with reason chips, cooldown handling, and quick actions to webhooks/incidents/limits; command centre shows tiny RAG badge.
- Webhooks/incidents now accept 15m windows for deep links; logging allowlists updated for RAG events; tests/docs refreshed.

## v0.8.24
- Load & Limits Pack: shared in-memory rate limiter with Retry-After/x-request-id/no-store applied to billing recheck, monetisation log, ops outcomes/effectiveness/watch, and ops system status.
- Billing recheck + ops actions show calm cooldown/rate-limit messages with sanitised logging; helper tightened for consistent headers.
- Ops System Status gains a Limits panel (approximate rate-limit hits/top routes) with deep links to audits/incidents; pressure counters feed notes and tests.

## v0.8.25
- Ops RAG status: deterministic 15-minute RAG helper with webhook/portal/checkout/rate-limit thresholds and reasons.
- New ops API + status page strip with reason chips, cooldown handling, and quick actions to webhooks/incidents/limits; command centre shows tiny RAG badge.
- Webhooks/incidents now accept 15m windows for deep links; logging allowlists updated for RAG events; tests/docs refreshed.

## v0.8.23
- Ops System Status: new ops-only API/UI with deployment/meta, 24h billing/webhook/incident/audit counts, webhook queue repeats, notes, refresh, and quick links.
- Webhook truth source: badge stays neutral unless delayed/failed/just-paid; correlation confidence returned by recheck and shown as a pill in Billing Trace.
- Perf/index hardening: new indexes on application_activities and ops_audit_log to keep ops/billing routes fast; logging allowlists expanded.

## v0.8.22
- Billing truth source: webhook badge now context-aware (neutral copy when credits exist, warnings only on true delays/failures) with updated support CTA logging.
- Correlation row gains confidence badges (healthy/unknown/delayed/failed) and recheck payload exposes correlationConfidence for consistent UI.
- Ops webhook queue enriched with last seen/repeats, chips for repeating/last hour, and one-click Watch shortcut; request/allowlist logs expanded.

## v0.8.21
- Webhook status v2: context-aware helper reduces false alarms (not expected vs watching/delayed/ok) across billing badge, trace, and recheck payload; badge offers delayed snippet copy only when needed.
- Billing correlation row now labels missing upstream as unknown when credits exist; missing-webhook hints only show when truly delayed.
- Ops webhook queue tightened to failures-only with clearer empty state; incidents webhook callout only triggers on failures; new logging/allowlists added.

## v0.8.20
- Webhook reliability signals: deterministic receipt ledger (last seen, dedupe hashes, error codes), surfaced in billing UI badge + trace row with missing-webhook hint and recheck response fields.
- Billing recheck now returns webhookReceipt/dedupe; logging expanded for webhook signal/trace copy.
- Ops webhook failures queue: new ops API + /app/ops/webhooks page with filters, masked exports, incidents/dossier links, and incidents callout shortcut.

## v0.8.19
- Resolution effectiveness v1: deterministic helper + ops API to track whether outcomes worked (yes/no/later with snooze), masked insights, and due-review surfacing.
- Ops UI: ResolutionCard follow-up prompt with reason/note + save, /app/ops/resolutions gains Due reviews tab, request/dossier links, and compact failure insights.
- Billing playbooks: suppress only when a successful outcome exists in 24h; failed attempts keep playbooks visible with a hint; new logs/allowlists added.

## v0.8.18
- Ops resolution analytics: ops-only summary API + /app/ops/resolutions page with filters (24h/7d, code, user), masked exports, top outcomes/actors, and recent list linking to incidents/dossier.
- Watchlist: ops watch API + UI (ResolutionCard delay outcomes, Incidents callout, dossier) to track webhook/delay cases; logging wired for add/view.
- Playbook suppression: billing playbooks suppressed when a recent resolution exists (request/user within 24h) with muted “Resolved recently” card and telemetry.

## v0.8.13
- Billing webhook health + trace: /app/billing shows a webhook status badge and anchorable Billing timeline panel with Re-check status (no navigation), masked trace snippet copy, and refreshed timeline/delay/webhook health model.
- Webhook health helper + recheck API expose masked counts/status/lag; credit delay + timeline reuse deterministic helpers with non-blocking logging/allowlists.
- Ops: Incident Console gains webhook health callout with filter chips; dossier billing triage card now shows billing timeline + trace link/snippet; monetisation logging allowlists expanded for new events.

## v0.8.14
- Billing correlation v2: deterministic helper classifies checkout→webhook→ledger states into delay buckets (waiting_webhook/ledger/ui_stale/unknown) with masked evidence.
- Billing Trace panel adds correlation row, delay classification CTA, and recheck integration; /api/billing/recheck returns correlationV2 and delayV2 with requestId + no-store.
- Ops Incident Console adds delay bucket callout with filter chips; logging allowlists expanded; new tests for correlation, delay buckets, webhook health/regressions; docs/smoke updated.

## v0.8.15
- Recheck throttling: /api/billing/recheck limited per-user/IP with Retry-After; UI disables Re-check during cooldown; rate-limit logs added.
- Delay playbooks: Billing Trace shows guidance for delay buckets with copyable support snippet CTA; events are sanitised and logged.
- Ops deep-links: Billing/ops views add “Open related incidents” (+ audits from dossier) with masked params; allowlists extended; tests for rate-limit, playbooks, links added; docs updated.

## v0.8.17
- Ops resolution outcomes: new helper + ops API to save structured resolution outcomes (enum codes + optional note) tied to requestId/userId with masked meta.
- ResolutionCard now captures and shows recent outcomes (save outcome, view list) in Incidents and User Dossier; logs click/success/error events best-effort.
- Outcomes surface inline in Incident Console and dossier (recent outcomes); docs/tests updated for helper, route, and UI flow.

## v0.8.16b
- Ops Resolution card v1: Incident Console shows an Ops Resolution card for billing/requestId contexts with outcome select, customer reply copy/regenerate, support snippet, and safe ops links; User Dossier Billing triage now includes the same card (works even without Stripe snapshot).
- Logging wired for resolution view/actions/link clicks with sanitised meta; integration tests cover incidents and dossier placement plus component actions.

## v0.8.16a
- Billing help prompt v1: /app/billing now surfaces a dismissible “Did this help?” prompt with Yes/No flows, support snippet copy, and portal retry link; dismiss persists 7 days.
- Telemetry wired for prompt view/yes/no/dismiss/copy/retry with sanitised meta; deterministic tests added for prompt behaviour.

## v0.8.12
- Billing timeline + credit delay: /app/billing shows recent billing activity with request refs, support snippet copy, and a credit delay detector card with refresh and snippet logging.
- Added deterministic helpers for billing timeline/credit delay; ops incidents gain webhook/credit trace ratios with filter chips; monetisation allowlist extended for timeline/delay/trace logging.
- Billing docs/smoke updated; no mutations or auto-fixes included.

## v0.8.11
- Ops billing triage v1: new ops-only Stripe snapshot endpoint with masked customer/subscription signals, local billing status, and deterministic next-step helper.
- Ops user dossier adds Billing triage card with refreshable snapshot, next-step hints, focused billing/portal links, and optional Stripe dashboard shortcuts; incidents console links directly to triage for billing-related groups.
- Helpers added for Stripe price mapping and triage logic; monetisation allowlist expanded with new ops billing events; docs/smoke updated.

## v0.8.10
- Billing guardrails v1: new status strip on /app/billing shows subscription state, credits, last action, and ops-support flags with support snippet modal and sanitized logging.
- Portal return guardrails: premium banner for `portal_error` with retry link, dismiss, and support snippet logging; billing allowlist expanded with non-blocking events.
- Reconciliation hint surfaces when checkout success lacks recent credits; ops Incident Console shows billing health mini-summary with filters/chips; deterministic helpers + tests added for billing status, portal banner, reconciliation, and ops health.

## v0.8.09
- Activation + Keep Momentum hardening: CTAs always target the newest active application, fall back to creation when none exist, and use overview anchors when a specific section isn’t available; skip-for-week persistence cleans up expired state.
- Keep Momentum empty state now surfaces a create-application CTA; fallback pipeline deep-link points at the newest app overview instead of a generic list.
- Monetisation logging now sanitises meta (no URLs/emails/blobs), dedupes activation views/CTAs daily and keep-momentum weekly, and stays non-blocking; new unit tests cover CTA selection and logging guardrails.

## v0.8.05
- Activation loop v1: deterministic helper outputs add app → outreach → follow-up → outcome (+ interview/keep-momentum) with progress, next-best recommendation, and celebration copy.
- Dashboard shows Activation card with progress bar, step list, next-best CTA, and ErrorBanner fallback; activation events are allowlisted and logged best-effort.
- Helper + microcopy + tests cover deterministic ordering and mature-user keep-momentum guidance; no schema changes.

## v0.8.06
- Activation funnel (ops): new /api/ops/activation-funnel route and ops page with aggregated activation events, step/CTA breakdown, and time-to-first-value proxies (masked counts only).
- Activation loop hardening: completion detection uses persisted facts (non-archived apps), activation milestones logged on outreach/follow-up/outcome creation, and activation completed/skip/week logging added.
- Dashboard Activation card gains skip-for-week, CTA logging, and primary application context for metrics; ops quick link added.

## v0.8.07
- Activation card polish: stable CTA routing with fallbacks/hints, skip-for-week and completion events deduped, and metadata hardened with navigation-only logging.
- Dashboard actions deduped/ranked deterministically (activation-first, then high-impact items) to avoid duplicate cards; progress copy aligned with activation core steps.
- Activation helper uses persisted facts only, excludes archived apps, and exports core progress; new tests for dedupe, progress, telemetry meta, and activation routing logic.

## v0.8.08
- Keep Momentum loop v1: deterministic helper recommends one weekly move (follow-up, outcome, interview prep, evidence, fallback) with debug signals and skip handling.
- Dashboard adds Keep Momentum card with CTA/secondary/skip logging, using activation-safe metadata and anchors; activation stays present without conflict.
- Ops Activation Funnel shows keep-momentum aggregates (views/clicks/skips + top rules); monetisation allowlists expanded; new unit tests for rules/telemetry.

## v0.8.04
- Portal route hardened: always sets x-request-id + no-store, redirects on errors with portal_error=1&mode=navigation, logs portal events without URLs, JSON errors only when requested.
- Billing portal error banner gains Try again link; portal links stay navigation-only; logging includes mode/destination.
- Ops incidents show Stripe portal failure spike callout; Ops support actions now include navigation-only portal open/retry links.

## v0.8.03
- Stripe portal navigation uses direct redirects (no fetch) via /api/billing/portal; errors bounce back to billing with requestId banner params.
- Billing portal buttons are anchors again; click logging uses fire-and-forget, and portal error banners can be dismissed without reload.
- Portal route supports JSON errors via format=json/Accept header; tests updated for redirect and banner parsing.

## v0.8.02
- Hotfix: Stripe portal buttons on Billing now use /api/billing/portal with real links, redirect fallback, and requestId-aware error banners.
- Portal creation errors log billing_portal_* events and return structured JSON; incidents/audits can now see failures.
- Billing UI shows portal ErrorBanner with copyable support snippet; new portal link builder + tests.

## v0.8.01
- Ops Incident Playbooks v1: deterministic billing-first playbooks for portal/checkout/webhook/credits/monetisation issues with likely causes + next steps.
- Incidents console shows playbook card with deeplink actions (Billing/dossier/support-link generation/customer reply copy) and masked link output.
- New playbook microcopy + support link logging, requestId filter still pre-fills; exports remain masked; docs/smoke updated.

## v0.8.00
- Ops correlation v1: audits requestIds open Incidents, incidents link back to audits; requestId filters prefill and log; actor/target quick dossier links.
- Support bundle helper (masked) surfaced in audits + incidents with copyable snippet/bundle and billing-first next steps; exports now include masked header notes.
- Quick filter chips (time/high-impact/billing) and export hardening; monetisation events allowlisted for cross-links/bundles; docs/smoke updated.

## v0.7.99
- Ops Audits v1: new ops-only /app/ops/audits page with filters (user/actor/action/date/q), masked results table, pagination, and JSON/CSV export; dossier now links directly with user filter.
- New /api/ops/audits endpoint enforces RBAC, requestId/jsonError, masking, and cursor pagination with limit caps + validation.
- Observability: ops audit list logs view/filter/export events (hashed q), guard script covers new route; smoke/docs updated.

## v0.7.98
- Ops Command Centre: user lookup now searches by email or user id via /api/ops/users/search, shows results with Open dossier action, and focuses the search box from the shortcut card.
- New ops search API enforces RBAC + structured errors, hashes queries in audit logs, and fills names/roles from profiles/user_roles.
- Ops guardrail script now checks for requestId/error helpers across ops routes; guard runs in CI; quick links include Incidents + Audits (coming soon).

## v0.7.97
- Ops support links v2: unified destination mapper (billing/app/interview) with from=ops_support/support=1 flags, tab/focus defaults, and app-ownership validation on the API.
- Support actions card now generates billing pack/plan/portal links plus application outreach/offer/outcome or interview focus links (recent app/manual ID), showing the URL + timestamp even if copy is blocked.
- Application/Interview focus scroll-highlights retry for ~1.5s with per-app dedupe; new /app/interview anchor handles ops deep links to the Interview Focus Session.

## v0.7.96
- Ops entry now visible in the app nav for ops/admin/super_admin, logging ops_entry_click when used.
- All /app/ops routes show a premium Access denied (403) page for non-ops with reference/support snippet instead of 404.
- Ops landing page now acts as a simple hub with quick links; new logging allowlists and nav visibility test added.

## v0.7.95
- Ops support deeplinks now jump to the specific pack card (`pack-starter|pro|power`), with fallback to the Packs section if missing. Resolver priority unchanged (portal/flow > plan > pack > compare) with pack anchors stable.
- Deeplink apply helper supports preferred + fallback targets and logs fallback usage; scroll offset fallback stays in place; highlight applies to the actual target.
- Added resolver + apply fallback tests; docs/smoke updated for pack-card focus.

## v0.7.93
- Billing deeplink handler reliability: runs on page load, retries until anchors exist, scrolls + highlights with support helper; debug note available via debug=1. Logs attempt/applied/missing without blocking.
- New apply helper with retry test; ops support deeplink events allowlisted.

## v0.7.92
- Billing deeplink anchors are now always present (#compare/#portal-return/#subscription/#packs) so ops support links reliably scroll/highlight the intended section.
- Deeplink handler retries until anchors appear and logs target-missing; highlight + helper line now run after anchor resolves.
- Added anchor regression test; logging allowlist expanded for deeplink events.

## v0.7.91
- Ops support links now deep-link into Billing: packs/subscription/portal-return sections get anchors (#packs/#subscription/#portal-return/#compare), auto-scroll + highlight for support visitors.
- Added deterministic billing deep-link resolver with tests; logging for ops_support_deeplink applied/cta click.
- Billing shows support-focused helper when support links are used; support-link destination params remain unchanged.

## v0.7.90
- Fix ops support-link JSON integrity: route now always returns complete JSON (NextResponse.json) with full URL and destination params.
- Ops Support actions UI recovers from parse issues, only shows “generated” after a URL is set, keeps last good link visible, and shows ErrorBanner with requestId on failure.
- Added route regression test for support links to ensure parseable JSON with required params.

## v0.7.87
- Ops Support Toolkit v1: ops user dossier gains Support actions card with manual credit adjustments (admin+ only, guarded with requestId/error banners) and support link generator with from=ops_support flags.
- New ops APIs for credits adjust and support links are audited into ops_audit_log; audit trail now visible on the dossier.
- Added ops guard script, ops microcopy, and tests for credit validation and support-link builder; docs/smoke updated.

## v0.7.88
- Hardened ops Support Link generator: URL always shows/copies even if logging fails; copy failure now shows manual copy hint and keeps the link visible with last-generated timestamp.
- /api/ops/support-link logging is best-effort; monetisation log API now returns ok:false instead of 500s on failures, with a safety test.
- Ops microcopy expanded for support link success/copy blocked; docs updated with new smoke steps.

## v0.7.89-hotfix
- Fix ops support-link JSON truncation: /api/ops/support-link now always returns complete JSON via NextResponse.json with full URL.
- Ops Support actions UI recovers from JSON parse failures (regex/text fallback) and still displays the URL for manual copy; shows ErrorBanner with requestId on failure.
- Added regression test for support link builder to ensure required params.

## v0.7.84
- Completed observability coverage: remaining API routes now return structured errors with requestId headers and safe capture (outcomes summary/insights/link, referrals, diagnostics, etc.).
- Premium ErrorBanner and support snippet wiring kept across billing/outreach/outcome flows; added error-shape test for requestId/code.

## v0.7.85
- Ops Incident Console v2: grouped/deduped incident feed with counts, filters (time/surface/code/flow/search/high-impact), related-event timeline, and CSV/JSON export with safe fields.
- Added correlation/grouping helpers and incident-correlation test; export is sanitized (masked users, no secrets).
- Lookup shows related timeline and copyable snippets/refs; docs updated with new smoke steps and capabilities note.

## v0.7.83
- Billing compare section recommends subscription vs top-up with deterministic helper, “Why this?” bullets, and checkout/portal handling with requestId-aware error banners.
- New compare events allowlisted; smoke tests updated.

## v0.7.82
- Ops Incident Console v1: requestId lookup + recent incident feed (last 7d) with copyable support snippet and masked user info, behind ops guard.
- Incident helper normalises monetisation/checkout failure logs into safe surfaces/codes/messages; filters by surface/time.
- Added microcopy deck and ops smoke steps; requestId meta now logged for checkout/portal failures to enable lookup.

## v0.7.81
- Observability v1: request IDs threaded through key APIs (checkout, portal, outcomes, referrals, contacts, monetisation, diagnostics, webhook) with standard JSON error shapes and lightweight Sentry capture.
- Premium error UX: central error microcopy, reusable ErrorBanner with copyable reference/support snippet, checkout/portal/contact/outcome flows now surface references and retry/dismiss actions.
- Support snippet helper + tests to speed support handoff; docs updated with error reference smoke.

## v0.7.79
- Offer close-out loop after acceptance: panel under Offer Pack lists other apps, lets you select/bulk mark closed with outcome logging, and send warm/direct/short withdrawal templates via Gmail/LinkedIn/Copy.
- Contact-missing path links to outreach; retries on failed outcome logging; dismiss/persist per week.
- Monetisation events updated; deterministic helper/tests keep templates and grouping stable.

## v0.7.80
- Outreach Autopilot v1: follow-ups due strip on Dashboard and Applications shows overdue/due items (max 7) with one-tap send/log/schedule modal using outreach variants.
- Contact-missing path deep-links to outreach; recovery badge for ≥72h overdue; new logging events allowlisted.

## v0.7.78
- Offer Win Loop tile on Insights highlights the most recent offer/negotiation with deep links into Offer Pack, outcome logging, and a guided checklist.
- Monetisation events allowlisted for offer win interactions; deterministic helper/test for candidate selection and step hrefs.

## v0.7.76
- Offer & Negotiation Pack v1 on application overview: offer summary, counter builder, negotiation scripts (polite/direct/warm), and decision templates with copy buttons.
- Panel unlocks on offer outcome or manual toggle; local persistence, completeness indicator, and new logging events.
- Next-best actions include offer follow-ups; outreach insights and variants remain intact.

## v0.7.77
- Offer Pack gains Decision logging (negotiating/accepted/declined/asked for time) with notes, auto outcome quick log, and persistence.
- Next-best actions now react to offer decisions; accepted state surfaces “close other applications” copy templates; new monetisation events allowlisted.
- Added deterministic tests for decision → outcome mapping; docs updated.

## v0.7.75
- Outreach Engine v4: added Polite/Direct/Warm variants with quality cues, persistence, and Gmail/LinkedIn/send/copy logging.
- Outreach performance insights (14d reply rate, sent/replies/follow-ups + tip) on Insights and Command Centre Outreach tab.
- New deterministic outreach variant and insights helpers with tests; new monetisation events allowlisted.

## v0.7.74
- Interview Focus Session v3 on Interview tab: guided 15–25 minute flow with Do now/Up next/If time lanes, Ready/Undo, session completion, and copy-all answers.
- Deterministic session builder and microcopy deck; new session logging events allowlisted; anchored above Answer Pack for deep links.
- Added helper test for deterministic session selection.

## v0.7.73
- Outcome Loop v2 with reusable OutcomeQuickLog across Weekly Review, Outreach panel, and Outcome panel (status/reason/notes, success toast).
- Outcome insights now surface top reasons and recommended actions; next-best actions weighted by latest outcomes for more relevant nudges.
- Added outcome next-move helper/test and allowlisted logging for quick log/insights/next move; docs updated with new smoke steps.

## v0.7.70
- Outreach Engine now supports saved recruiter contact (name/email/LinkedIn) with API read/write and validation.
- Outreach panel adds contact capture plus one-click Gmail/LinkedIn sends with mailto prefill and missing-contact logging.
- Applications Command Centre Outreach tab shows Send (Gmail/LinkedIn) when contact exists or Add contact deep link when missing.
- New outreach logging events allowlisted; added helper test for contact validation/mailto builder.

## v0.7.71
- Outreach panel adds reply triage (Interested/Not now/Rejected/No response), notes, and quick outcome logging plus next-move card.
- Deterministic next-move helper surfaces in Outreach panel and Command Centre rows; follows triage/overdue state.
- New monetisation events for triage/next-move/mailto/quick outcomes; outreach contact/send flows preserved.
- Added helper test for next-move mapping; docs updated for reply triage smoke checks.

## v0.7.72
- Added `/app/ops` Command Centre guarded by env allowlist for support; search users and view billing/credits/app snapshots.
- New user dossier at `/app/ops/users/:id` shows billing, apps, outreach, outcomes, and next actions (read-only).
- Ops env variables documented; diagnostics/ops usage guarded with server-only checks.

## v0.7.69
- Added Outreach panel on Activity tab with copy/log/schedule flow, next follow-up status, and reply capture, anchored at `#outreach`.
- Applications Command Centre now has an Outreach queue with overdue/due sorting, copy + log modal, and deep links into applications.
- Deterministic outreach engine + microcopy deck, new logging events allowlisted, and a small helper test for template selection.

## v0.7.68
- Added “Today’s Focus” card on the Interview tab with deterministic top-3 recommendations, Done/Undo, and weekly persistence.
- Answer Pack items now have stable anchors with quality/next-step lines; Interview Pack questions show quality badges to deep-link from focus.
- New interview focus logging events allowlisted plus helper/test to keep ranking deterministic; docs updated with new smoke steps.

## v0.7.62
- Unified checkout return handling with a shared parser and premium banner states (success, cancel, failed) plus resume countdown copy.
- Added redirect-blocked helpers on checkout CTAs with retry/open-billing buttons and new monetisation events, plus a compact completion nudge on return.
- Completion watchdog/nudge copy refreshed; return events are now allowlisted alongside new checkout return/retry/help events.

## v0.7.63
- Subscription Home on Billing for active subs: weekly stats, next actions, risk badge, next-week preview, and gentle save/cancel offer with portal links.
- Low-activity “Save your streak” nudge on Insights for subscribers with no movement; deterministic retention scoring helper added.
- Monetisation allowlist updated for subscription home/save-offer events; added retention helper test and checkout-return parser test.

## v0.7.64
- Portal sessions now return with flow/plan context; Billing shows a “Welcome back” banner with keep/cancel intent logging and portal reopen.
- Added churn-intent events to monetisation allowlists plus portal-return parser/test; banner persistence keyed per week.
- Billing portal API now appends portal=1 + flow/plan to return URLs for reliable detection.

## v0.7.65
- Added cancel-flow Save Offer card on Billing after portal cancel returns, with downgrade/keep/top-up recommendations and portal flows.
- Save-offer events allowlisted; portal API accepts flow/plan from body and appends to return URLs; outcome lines log active/inactive once.
- New save-offer helper and test guide deterministic variant/portal flow selection; docs updated for cancel-flow smoke.

## v0.7.66
- Added cancellation reason picker with premium buckets, pause hint, and portal reopen CTA on cancel returns; selection persists per week.
- Portal return logging hardened with a stable return key to dedupe view/save-offer logs; new return-key test added.
- Allowlist extended for cancel-reason/pause hint events; docs updated for cancel-return smoke.

## v0.7.67
- Added cancel deflection step before portal: reason picker + recommended save action (downgrade/pause/finish week) with one-click portal threading (flow=cancel_deflect).
- Deflection logs (view/select/offer/save/continue/dismiss) and respects weekly dismissal; cancel deflect offer helper + test added.
- Centralised premium microcopy deck for subscription retention flows and applied across cancel/save UI; allowlist updated for deflection events; docs refreshed.

## v0.7.61a
- Added streak saver subscription funnel instrumentation end-to-end (view/dismiss/CTA, billing banner, plan select, checkout start/failed, return, active detected).
- Billing now respects `from=streak_saver&plan=` params, preselects plan, shows a streak banner with logging, and threads plan through checkout.
- Monetisation allowlists and API validation updated for new streak saver events.

## v0.7.59
- Weekly Review “Applications moved forward” now uses deterministic reasons with examples dropdown plus inline outcome capture to close the loop.
- Added moved-forward helper with explainable links, streak-safe storage key, and outcome inline save logging.
- Updated smoke tests for the new review UX.

## v0.7.57
- Weekly Coach card now supports per-row completion (Mark done/Undo), week-complete summary with “Add one more step”/“Leave it there”, and action-specific microcopy constants.
- Dedupe/sections retained; completion persists per week in local storage with new monetisation events for done/undo/complete.
- Updated smoke tests for completion interactions.

## v0.7.56
- Weekly Coach card now groups actions into Do next/Up next/If you have time with per-type dedupe and inline “also needed” expansion.
- Action buttons use type-specific labels and the header shows a single goal badge with a refreshed title.
- Added UI polish for the “This Week” hierarchy without changing underlying deep links or logging.

## v0.7.55
- Added Weekly Coach Loop v1 on /app/insights with a “This Week” card, deterministic deep links, and simple weekly targets.
- New weekly plan helper (server-deterministic) plus a lightweight client card with monetisation logging on view/click.
- Included a small unit test and smoke/docs updates for the new insights card.

## v0.7.51
- Billing availability now comes from server-side price ID checks; client components receive booleans so packs/subscriptions stay enabled when env vars exist.
- Added a client env guard wired into lint to block Stripe env usage or server-only billing imports in client components.
- Removed Stripe env exposure from next.config.js; checkout guardrails remain the source of truth.

# Changelog

# Changelog

## v0.7.54
- Added Stripe portal-based upgrade/downgrade for Monthly 30/80 with current-plan badge on Billing and contextual upgrade/downgrade buttons plus return banner when coming back from portal.
- Subscription gate nudge now surfaces an upgrade hook for heavy usage on Monthly 30 and opens the portal with retry messaging on failure.
- Expanded subscription status helper (active/current plan/portal availability) and monetisation logging for portal flows; added mapping test.

## v0.7.53
- Billing now shows both Monthly 30 and Monthly 80 with a plan selector, recommended badge, and price-aware CTA/compare; unavailable plans disable with clear copy.
- Subscription gate nudges use the same selector with quick switch to Monthly 80 and log selector events; manage subscription now redirects via portal fetch.
- Added deterministic subscription recommendation v2 (usage-based signals) and plan selector logging events plus a helper test.

## v0.7.50
- Added deterministic Top-up vs Subscription compare blocks on Billing and gate modals with recommended styling, availability guards, and monetisation logging.
- New comparison helper chooses subscription vs top-up based on cadence/availability, driving consistent CTAs across billing and soft gates.
- Soft gates now show compact compare with resume-aware checkout; added helper tests for comparison logic.

## v0.7.50-precheck
- Added a safe billing diagnostics API exposing only booleans for Stripe price IDs, secret presence, site URL, and deployment hint.
- Billing page now surfaces a diagnostics link (non-production or ?diag=1) when packs/subscriptions are unavailable to show missing env keys without secrets.

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
## v0.8.43
- UI-first Alerts ACK: Ops UI adds Acknowledge + Copy ACK link (curl optional) for firing/test events with badges and state hints; ACK tokens respect configurable TTL (ALERTS_ACK_TTL_SECONDS) and new logs cover ack clicks/link copy/public ack outcomes.
