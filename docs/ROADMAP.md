# Roadmap

## Now

### Application detail tabs (shipped v0.7.12a)
Outcome: the application detail page now uses Overview, Apply, Evidence, Interview, Activity, and Admin/Debug tabs so each workflow is easy to reach without scrolling forever.
Scope boundary: the existing panels are moved into tabs with lazy-loading, no behaviour changes are introduced.
Success criteria: each tab shows the expected content and the tab query parameter respects deep links.
Not in scope: redesigning Smart Apply, autopacks, or evidence components beyond their current behaviour.

### Interview Pack v1 (shipped)
Outcome: deterministic interview-ready prompts and a DOCX pack on the application detail page (shipped v0.6.9).
Scope boundary: role snapshot, questions, weak spots, STAR prompts, and DOCX export only.
Success criteria: pack renders reliably, prompts are copy-ready, and export downloads cleanly.
Not in scope: AI rewriting, new navigation, or multi-application packs.

### Practice Mode (shipped)
Outcome: STAR practice drafts with deterministic scoring and saved answers (shipped v0.7.0a).
Scope boundary: practice inside Interview Pack only, deterministic scoring, no AI.
Success criteria: scores, recommendations, and drafts persist per application.
Not in scope: automated coaching or adaptive prompts.

### Rewrite Coach (shipped)
Outcome: deterministic STAR rewrites with before/after previews (shipped v0.7.0b).
Scope boundary: rewrite inside Practice Mode only, no new facts added.
Success criteria: rewrites apply cleanly and persist with improved metadata.
Not in scope: AI rewriting or automatic submission changes.

### Practice Dashboard + Drill Mode (shipped)
Outcome: per-application practice summary and a focused drill flow (shipped v0.7.1).
Scope boundary: deterministic scoring and rewrites only, no new AI prompts.
Success criteria: dashboard reflects scoring status and drill updates persist.
Not in scope: AI coaching or automatic scheduling.

### STAR Library v1 (shipped)
Outcome: per-gap STAR drafts created from STAR-target evidence (shipped v0.7.10).
Scope boundary: deterministic prefills, editable drafts, and drill paste actions.
Success criteria: drafts can be created, edited, and surfaced in Practice flows.
Not in scope: AI rewriting or automated scoring changes.

### Answer Pack v1 (shipped)
Outcome: deterministic interview answers derived from STAR drafts (shipped v0.7.11).
Scope boundary: Standard and 90-second variants, applied into Practice drafts.
Success criteria: answers generate, copy/apply, and persist per question.
Not in scope: AI rewriting, new question generation, or PDF/ZIP outputs.

### Application Kit v1 (shipped)
Outcome: deterministic readiness checklist and a single ZIP for submission artefacts (shipped v0.7.2).
Scope boundary: checklist + kit download only, no new exports beyond existing assets.
Success criteria: kit ZIP includes CV, cover letter, interview pack, and STAR drafts.
Not in scope: PDF export or automated applications.

### Smart Apply v2 (shipped)
Outcome: compact Smart Apply header with readiness, status, closing date/source, a collapsible checklist, and a “Next 3 actions” strip with tab deep links (shipped v0.7.17).
Scope boundary: deterministic checklist + next actions; no automation or external integrations.
Success criteria: checklist timestamps update from exports; next actions deep-link to Apply/Interview/Activity tabs; collapsed state persists per application.
Not in scope: sending applications or automatic follow-up messages.

### Job Link Fetch v1 (shipped)
Outcome: fetch a job advert snapshot from a link and use it for Role Fit and packs (shipped v0.7.4).
Scope boundary: deterministic fetch + extraction only, no scraping automation or AI summarisation.
Success criteria: fetched snapshots are stored and preferred when available.
Not in scope: storing raw HTML or automatic job description rewriting.

### Outcome Loop v1 (shipped)
Outcome: record outcomes with status/reason/notes, snapshot nearby actions (evidence, outreach, practice, exports, kit, follow-ups), and surface lightweight insights plus pipeline badges (shipped v0.7.21).
Scope boundary: deterministic forms, action snapshots, and simple insights only.
Success criteria: outcomes save and show in pipeline cards; insights render or show “not enough data yet”; suggested next steps link to the correct tab/anchor.
Not in scope: heavy analytics dashboards, charts, or automated decisions.

### Evidence Engine v1 (shipped)
Outcome: evidence suggestions for Role Fit gaps with one-click apply actions (shipped v0.7.5).
Scope boundary: deterministic matching using existing taxonomies only.
Success criteria: evidence can be selected and applied to achievements or STAR drafts.
Not in scope: AI-written evidence or cross-user sharing.

### Evidence Quality + Better Matching (shipped)
Outcome: improved evidence matching with fuzzy aliases and quality scoring (shipped v0.7.6).
Scope boundary: deterministic matching + quality heuristics, no AI.
Success criteria: quality-ranked evidence appears for common gaps with clear fallback actions.
Not in scope: AI-written evidence or cross-user sharing.

### Role Fit + packs
Outcome: keep Role Fit reliable with core/domain packs and fallback JD terms.
Scope boundary: deterministic signals, pack detection, and UI gap guidance.
Success criteria: non-zero coverage for typical JDs and actionable gaps.
Not in scope: LLM scoring, job-ad scraping, or auto-writing CV content.

### Pipeline and tracking
Outcome: a consistent view of status, next actions, and follow-up dates.
Scope boundary: status updates, activity logging, and reminders with ICS downloads.
Success criteria: users can see due/overdue items and log activity in one flow.
Not in scope: email sending, background notifications, or CRM integrations.

### Imports and exports (DOCX/ZIP)
Outcome: stable DOCX import preview/apply and professional DOCX exports.
Scope boundary: DOCX only, Standard + ATS-Minimal variants, ZIP submission packs.
Success criteria: export quality meets ATS expectations and import applies cleanly.
Not in scope: PDF export or file storage.

### Work History
Outcome: role history captured and available for export and interview prep.
Scope boundary: CRUD on Profile, DOCX import detection, DOCX export inclusion.
Success criteria: roles display correctly and export in Professional Experience section.
Not in scope: automated CV parsing beyond basic heuristics.

## Next

### Interview Lift
Outcome: raise interview conversion with deterministic next actions and STAR drafts.
Scope boundary: heuristics from Role Fit and CV content, no AI rewriting.
Success criteria: lift prompts appear after activity and are acted upon.
Not in scope: automated coaching or personalised prompts via LLMs.

### Outreach Engine
Outcome: repeatable, logged follow-up sequences per application.
Scope boundary: deterministic templates, copy-only, activity logging.
Success criteria: users can log outreach and schedule follow-ups quickly.
Not in scope: email delivery, messaging integrations, or automation.

### JD learning (opt-in + admin)
Outcome: improve Role Fit coverage using anonymised JD signals.
Scope boundary: opt-in learning events, admin review, published packs.
Success criteria: proposals can be reviewed and published safely.
Not in scope: storing raw job descriptions or auto-publishing.

### Billing and credits
Outcome: predictable credit purchase and usage tracking.
Scope boundary: Stripe checkout, webhook crediting, credit ledger.
Success criteria: credits are accurate and generation is gated correctly.
Not in scope: subscriptions, invoices, or team billing.

### Job advert enrichment (v0.7.7)
Outcome: optional structured fields derived from fetched job adverts.
Scope boundary: deterministic metadata extraction only.
Success criteria: users can review and accept extracted fields.
Not in scope: AI summarisation or external content storage beyond snapshots.

## Later

### Future platform upgrades
Outcome: agreed backlog of larger improvements once core modules stabilise.
Scope boundary: TBD after feedback cycles.
Success criteria: prioritised roadmap with user-validated outcomes.
Not in scope: commitments before validation.
