# Capabilities

## Auth and sessions
Magic-link sign-in with Supabase, SSR session refresh, and a server-side auth callback at /auth/callback.

## Profile and evidence
Profiles store name, headline, and location. Achievements capture STAR evidence with optional metrics. Work history stores roles, dates, summaries, and bullet highlights.

## Applications
Applications capture job title, company, description, status, and optional job advert link. Tracking fields support follow-up dates, contacts, activity history, and outreach stages.

## Job Link Fetch v1
Job advert links can be fetched server-side to store a read-only snapshot. Role Fit, Autopacks, and Interview Packs prefer the fetched snapshot when available.

## Autopacks
Autopacks generate CVs, cover letters, and STAR answers from profile and achievements. Users can edit and version outputs in-app.

## Role Fit and Interview Lift
Role Fit uses deterministic taxonomies, domain packs, and fallback JD terms to score coverage and suggest gaps. Interview Lift uses deterministic checks to recommend next actions and STAR drafts.

## Evidence Engine v1
Evidence Engine builds a tagged evidence bank from achievements and work history, suggests evidence for Role Fit gaps, and lets users attach evidence to STAR drafts or achievements.

## Interview Pack v1
Interview Pack builds a deterministic interview bundle from the job description, Role Fit signals, and Interview Lift actions, with questions, STAR prompts, weak spots, and a DOCX export.

## Practice Mode
Practice Mode adds per-question STAR drafting with deterministic scoring, recommendations, saved drafts per application, and a Rewrite Coach for improved STAR structure. A Practice Dashboard and Drill Mode help prioritise weak questions and practise one-by-one.

## Application Kit v1
Application Kit aggregates readiness checks, next best actions, and a ZIP download containing CV, cover letter, interview pack, and STAR drafts.

## Smart Apply v1
Smart Apply tracks submission readiness with a checklist, closing dates, source platforms, and submission status. Exports and kit downloads update the checklist automatically and prompt follow-up scheduling.

## Pipeline and tracking
A pipeline board shows status lanes, next actions, and activity history. The Action Centre provides follow-up templates, activity logging, and calendar invite downloads.

## Outreach Engine
Deterministic outreach templates for email and LinkedIn, one-click logging, and automated next-outreach scheduling.

## Imports and exports
DOCX import previews and applies profile fields, achievements, and work history. DOCX export supports Standard and ATS-Minimal variants plus a submission-pack ZIP.

## Billing and credits
Stripe Checkout is used for credit purchases, with a credit ledger and webhook-based crediting.

## Admin learning
Opt-in, anonymised JD learning events feed admin-reviewed domain pack proposals that can be published globally.

## Deterministic vs OpenAI usage
Deterministic engines include role-fit.ts, interview-lift.ts, outreach-templates.ts, submission-quality.ts, and metrics-helper.ts. OpenAI is only used for autopack generation via server-side API calls.

## Non-goals / Not supported
No PDF export. No job advert scraping or URL fetch. No auto-apply or multi-user workspaces. No email sending or messaging integrations. No storage of raw job descriptions for learning.
