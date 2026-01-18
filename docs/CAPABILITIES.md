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

## Outreach Engine
Deterministic outreach templates for email and LinkedIn, one-click logging, and automated next-outreach scheduling. Outreach panel on Activity tab plus an Outreach queue in Applications Command Centre for copy + log and deep-linking.

## Imports and exports
DOCX import previews and applies profile fields, achievements, and work history. DOCX export supports Standard and ATS-Minimal variants plus a submission-pack ZIP.

## Billing and credits
Stripe Checkout is used for credit purchases, with a credit ledger and webhook-based crediting. Pack selector offers Starter/Pro/Power options and paywall CTAs appear at high-intent points (apply wizard, interview packs, answer packs). The Billing page now recommends a pack based on workload, shows ROI copy in gates, and threads return-to-action plus resume banners after checkout. Optional subscriptions + auto top-up preferences live in Billing; webhook grants monthly credits.
Top-up vs Subscription comparison cards highlight the recommended option with deterministic reasons across Billing and soft gates, using the same resume-aware checkout.

## Monetisation analytics
Credit gates, checkout starts/successes, resume clicks, and autopack completions are logged deterministically. Insights shows a revenue funnel (7d/30d) plus top surfaces for gates and billing clicks to spot leaks quickly.
Recovery tile tracks checkout started/returned/completed and shows conversion hints to reduce drop-off; completion events are standardised across Autopack, Interview Pack export, Application Kit download, and Answer Pack generation.

## Marketing site
A public landing page explains the 20-minute flow (job advert → evidence → STAR → kit → submit), shows product tour cards, transparent pricing teaser, FAQ, and an optional AI Boost note. CTAs deep-link to signup/login or billing depending on auth.

## Dashboard v2
Signed-in users land on the Activation Command Centre: greeting with credits, top next-best actions, a compact active applications list with deep links into tabs/anchors, a coach nudge, and a funnel snapshot with response rate and a shortcut to Insights.

## Paywalls and resume
Credit gating is consistent across Autopacks, Interview Pack exports, Application Kit downloads, and Answer Pack generation. If credits are 0 you’re routed to billing with a saved return link; returning with `resume=1` shows a Resume Accelerator banner with a short countdown that auto-resumes the blocked action on the right tab/anchor (never auto-spends).

## Referrals
Shareable referral link gives +3 credits to inviter and invitee once on signup; redeeming is idempotent and self-referrals are blocked.

## Admin learning
Opt-in, anonymised JD learning events feed admin-reviewed domain pack proposals that can be published globally.

## Deterministic vs OpenAI usage
Deterministic engines include role-fit.ts, interview-lift.ts, outreach-templates.ts, submission-quality.ts, and metrics-helper.ts. OpenAI is only used for autopack generation via server-side API calls.

## Non-goals / Not supported
No PDF export. No automated job advert scraping beyond user-initiated fetch and text extraction. No auto-apply or multi-user workspaces. No email sending or messaging integrations. No storage of raw job descriptions for learning.
