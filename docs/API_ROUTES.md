# API routes

## Auth callback
GET /auth/callback
Auth: magic-link exchange via Supabase; no session required.
Input: query params code and optional next.
Output: redirect to /app or next path, or /login with error.

## Autopacks
POST /api/autopack/generate
Auth: required.
Input: JSON { applicationId: string }.
Output: JSON { autopackId, version, creditsRemaining, creditUsed }.
Errors: 400 validation, 401 unauthorised, 402 no credits, 429 rate limit, 404 not found, 500.
Runtime: nodejs.

PATCH /api/autopack/[autopackId]
Auth: required.
Input: JSON { cv_text, cover_letter, answers_json }.
Output: JSON { ok: true }.
Errors: 400 invalid payload, 401 unauthorised, 404 not found.

GET /api/autopack/[autopackId]/export/cv.docx
Auth: required.
Input: query param variant=standard|ats_minimal.
Output: DOCX file download.
Errors: JSON { error, detail? } with 401/404/400/500.
Runtime: nodejs, force-dynamic.

GET /api/autopack/[autopackId]/export/cover-letter.docx
Auth: required.
Input: query param variant=standard|ats_minimal.
Output: DOCX file download.
Errors: JSON { error, detail? } with 401/404/400/500.
Runtime: nodejs, force-dynamic.

GET /api/autopack/[autopackId]/export/submission-pack.zip
Auth: required.
Input: query param variant=standard|ats_minimal.
Output: ZIP download with CV, cover letter, and STAR JSON.
Errors: JSON { error, detail? } with 401/404/400/500.
Runtime: nodejs, force-dynamic.

GET /api/export/interview-pack.docx
Auth: required.
Input: query params applicationId and variant=standard|ats_minimal.
Output: DOCX interview pack download.
Errors: JSON { error, detail? } with 401/404/400/500.
Runtime: nodejs, force-dynamic.

GET /api/application/[applicationId]/kit.zip
Auth: required.
Input: path param applicationId.
Output: ZIP download with CV (ATS-Minimal), cover letter (ATS-Minimal), interview pack (Standard), and STAR drafts JSON.
Errors: JSON { error, detail? } with 401/404/400/500.
Runtime: nodejs, force-dynamic.

GET /api/interview-practice
Auth: required.
Input: query param applicationId.
Output: JSON { answers: [] } including improved rewrite fields when available.
Errors: JSON { error } with 400/401/500.
Runtime: nodejs, force-dynamic.

PUT /api/interview-practice
Auth: required.
Input: JSON { applicationId, questionKey, questionText, answerText, meta? }.
Output: JSON { answer, scoring } with deterministic rubric.
Errors: JSON { error, detail? } with 400/401/500.
Runtime: nodejs, force-dynamic.

POST /api/interview-practice/rewrite
Auth: required.
Input: JSON { applicationId, questionKey, questionText, answerText, meta? }.
Output: JSON { answer, scoring, improvedText, notes }.
Errors: JSON { error, detail? } with 400/401/500.
Runtime: nodejs, force-dynamic.

## Answer Pack
GET /api/answer-pack
Auth: required.
Input: query params applicationId and questionKey.
Output: JSON { standard, short90 } with answerText and STAR references.
Errors: JSON { error } with 400/401/500.
Runtime: nodejs, force-dynamic.

POST /api/answer-pack/generate
Auth: required.
Input: JSON { applicationId, questionKey, questionType, variant, starGapKey? }.
Output: JSON { answerText, starLibraryId, starGapKey, variant, questionType }.
Errors: JSON { error } with 400/401/404/500.
Runtime: nodejs, force-dynamic.

PATCH /api/answer-pack/apply
Auth: required.
Input: JSON { applicationId, questionKey, variant }.
Output: JSON { ok: true }.
Errors: JSON { error } with 400/401/404/500.
Runtime: nodejs, force-dynamic.

## Imports
POST /api/import/cv-docx
Auth: required.
Input: multipart/form-data with file field named "file" (.docx, max 5MB).
Output: JSON preview payload { profile, achievements, work_history, extracted }.
Errors: JSON { error, detail? } with 400/401/422/500.
Runtime: nodejs, force-dynamic.

POST /api/import/apply
Auth: required.
Input: JSON preview payload plus selections { applyProfile, applyAchievements, selectedAchievementIndexes, applyWorkHistory }.
Output: JSON { updatedProfile, createdAchievements, createdWorkHistory }.
Errors: JSON { error, detail? } with 400/401/500.
Runtime: nodejs, force-dynamic.

## Job adverts
POST /api/job/fetch
Auth: required.
Input: JSON { applicationId }.
Output: JSON { ok, status, jobTextChars, truncated? } for success, or { blocked: true, reason, message, urlHost, suggestedAction: "open_and_paste" } when the source blocks fetches.
Errors: JSON { error, detail?, hint? } with 400/401/404/502.
Runtime: nodejs, force-dynamic.

## Role Fit and Interview Lift
GET /api/applications/[id]/interview-lift
Auth: required.
Input: path param id.
Output: JSON { interviewLift, achievements }.
Errors: JSON { error } with 401/404/500.
Runtime: nodejs, force-dynamic.

POST /api/applications/[id]/lift-action
Auth: required.
Input: JSON { action: "add_evidence"|"add_metric"|"draft_star" }.
Output: JSON { ok: true }.
Errors: JSON { error } with 400/401/500.
Runtime: nodejs, force-dynamic.

POST /api/applications/[id]/star-draft
Auth: required.
Input: JSON { achievementId?: string }.
Output: JSON { ok: true, draft }.
Errors: JSON { error } with 400/401/404/500.
Runtime: nodejs, force-dynamic.

## STAR Library
POST /api/star-library/create
Auth: required.
Input: JSON { applicationId, gapKey, title? }.
Output: JSON { draft }.
Errors: JSON { error } with 400/401/404/500.
Runtime: nodejs, force-dynamic.

PATCH /api/star-library/[id]
Auth: required.
Input: JSON { title?, situation?, task?, action?, result? }.
Output: JSON { draft }.
Errors: JSON { error } with 400/401/404/500.
Runtime: nodejs, force-dynamic.

## Outreach
GET /api/applications/[id]/outreach
Auth: required.
Input: path param id.
Output: JSON { outreach: { stage, nextStep, templates, signals, metric } }.
Errors: JSON { error } with 401/404/500.
Runtime: nodejs, force-dynamic.

## Achievements helpers
POST /api/achievements
Auth: required.
Input: JSON { title, action, metrics? }.
Output: JSON { id }.
Errors: JSON { error, fieldErrors? } with 400/401/500.
Runtime: nodejs.

PATCH /api/achievements/[id]
Auth: required.
Input: JSON { clause?: string, metrics?: string }.
Output: JSON { id, updated }.
Errors: JSON { error } with 400/401/404/500.
Runtime: nodejs.

## Evidence Engine
GET /api/evidence/suggest?applicationId=...
Auth: required.
Input: query param applicationId.
Output: JSON { gaps: [{ signalId, label, suggestedEvidence[], selectedEvidence[] }] } where suggestedEvidence includes matchScore, qualityScore, and selected.
Errors: JSON { error } with 400/401/404/500.
Runtime: nodejs, force-dynamic.

POST /api/evidence/select
Auth: required.
Input: JSON { applicationId, evidenceId, signalId }.
Output: JSON { selectedEvidence }.
Errors: JSON { error } with 400/401/404/500.
Runtime: nodejs, force-dynamic.

POST /api/evidence/unselect
Auth: required.
Input: JSON { applicationId, gapKey, evidenceId }.
Output: JSON { ok: true }.
Errors: JSON { error } with 400/401/404/500.
Runtime: nodejs, force-dynamic.

POST /api/evidence/apply
Auth: required.
Input: JSON { applicationId, evidenceId, signalId, mode }.
Output: JSON { ok: true }.
Errors: JSON { error } with 400/401/404/500.
Runtime: nodejs, force-dynamic.

## Calendar
GET /api/calendar/followup
Auth: required.
Input: query param applicationId.
Output: text/calendar attachment followup.ics.
Errors: JSON { error } with 400/401/404/500.
Runtime: nodejs, force-dynamic.

## Billing (Stripe)
POST /api/stripe/checkout
Auth: required.
Input: none (uses STRIPE_CREDITS_PRICE_ID).
Output: JSON { url } for Stripe Checkout.
Errors: JSON { error } with 400/401/500.
Runtime: nodejs.

POST /api/stripe/webhook
Auth: webhook signature required.
Input: raw webhook payload; header stripe-signature.
Output: JSON { received: true }.
Errors: JSON { error } with 400/500.
Runtime: nodejs.

## Admin learning
POST /api/admin/packs/publish
Auth: admin only (CVFORGE_ADMIN_EMAILS).
Input: JSON { proposalId }.
Output: JSON { status, slug, version }.
Errors: JSON { error } with 400/401/403/404/500.
Runtime: nodejs, force-dynamic.

POST /api/admin/packs/reject
Auth: admin only (CVFORGE_ADMIN_EMAILS).
Input: JSON { proposalId }.
Output: JSON { status: "rejected" }.
Errors: JSON { error } with 400/401/403/500.
Runtime: nodejs, force-dynamic.

POST /api/admin/packs/update
Auth: admin only (CVFORGE_ADMIN_EMAILS).
Input: JSON { proposalId, title, signals[] }.
Output: JSON { status: "updated" }.
Errors: JSON { error } with 400/401/403/500.
Runtime: nodejs, force-dynamic.

## Outcomes
POST /api/outcomes/create
Auth: required.
Input: JSON { applicationId, status, reason?, notes? }.
Output: JSON { ok, outcome, actionSummary }.
Errors: JSON { error } 400/401/404/500. Runtime: nodejs, force-dynamic.

GET /api/outcomes/summary?applicationId=...
Auth: required.
Output: JSON { ok, summary, actionSummary, suggestedNext[] }.
Errors: JSON { error } 400/401/500. Runtime: nodejs, force-dynamic.

GET /api/outcomes/insights
Auth: required.
Output: JSON { ok, insights|null, message? }.
Errors: JSON { error } 401/500. Runtime: nodejs, force-dynamic.

POST /api/outcomes/link-action
Auth: required.
Input: JSON { outcomeId, applicationId, actionType, actionCount? }.
Output: JSON { ok }.
Errors: JSON { error } 400/401/500. Runtime: nodejs, force-dynamic.

## Utility
GET /api/me
Auth: required.
Input: none.
Output: JSON { id, email, lastSignInAt }.
Errors: JSON { error } with 401.
