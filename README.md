# CVForge

CVForge is a CV and application pack builder with Supabase auth and Stripe-powered credits.

## Getting started

1. Copy env vars:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in values in `.env.local` (see `ENV.md`).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the dev server:
   ```bash
   npm run dev
   ```

## Scripts
- `npm run dev` - local dev server
- `npm run lint` - ESLint
- `npm run typecheck` - TypeScript check
- `npm run build` - production build

## How to use (Phase 2)
1. Sign in with a magic link at `/login`.
2. Visit `/app/profile` to update your profile and add achievements.
3. Create a new application at `/app/applications/new`.
   - Optional: add a job advert link for quick reference.
4. Edit or delete applications from `/app/applications`.
5. Open an application and generate an autopack.
6. Edit the autopack content and save changes.
7. Download the CV or cover letter DOCX from the autopack editor.

## Phase 2 smoke test checklist
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Sign in via magic link and reach `/app`.
- Update profile fields and confirm the success banner.
- Add, edit, and delete an achievement.
- Create a new application and confirm redirect to the detail page.
- Edit an application and delete it from the list.
- Generate an autopack and confirm a new version appears.
- Edit CV/cover letter/answers JSON and save successfully.

## Supabase
- Run the SQL migration by following `supabase/README.md`.
- Apply `supabase/migrations/0002_job_url.sql` to add the optional job advert link.
- Apply `supabase/migrations/0003_learning_events.sql` and `supabase/migrations/0004_domain_packs.sql` for Role Fit learning.
- Apply `supabase/migrations/0005_application_tracking.sql`, `supabase/migrations/0006_application_activities.sql`, `supabase/migrations/0007_pipeline_actions.sql`, and `supabase/migrations/0008_interview_lift.sql` for pipeline tracking and action centre fields.
- Configure auth redirect URLs to include your site URL and `/app`.
- Magic-link auth completes at `/auth/callback`, so ensure `${NEXT_PUBLIC_SITE_URL}/auth/callback` is in your redirect allowlist.

## Stripe
- Create a webhook endpoint at `/api/stripe/webhook` and add the signing secret.
- Use a Price ID for the credits pack in `STRIPE_CREDITS_PRICE_ID`.
- Credit pack rule: £9 → 10 credits.
- Test card: `4242 4242 4242 4242` (any future date, any CVC).

## OpenAI (Phase 2)
- Set `OPENAI_API_KEY` to enable autopack generation.
- Optional: set `CVFORGE_ALLOW_NO_CREDITS=true` to bypass credit checks in development.

## DOCX export
- DOCX exports are generated server-side from autopacks; no additional env vars required.
- v0.5.1: exports are submission-ready and placeholders are removed automatically.
- v0.6.5: exports support Standard and ATS-Minimal variants plus a submission-pack ZIP (CV + cover letter + STAR JSON).

## DOCX import
- v0.5.9: DOCX CV import runs server-side for preview only; files are not stored.

## Role Fit learning (v0.6.0)
- Opt in from `/app/profile#privacy` to share anonymised job advert signals (job adverts only; no CV/profile content).
- Admins review proposals at `/app/admin/learning` (set `CVFORGE_ADMIN_EMAILS`).
- Stored signals are redacted terms/phrases only; raw job descriptions are not persisted.

## Application tracking + follow-ups (v0.6.2)
- Visit `/app/pipeline` to see a status board and follow-up reminders.
- Use the Tracking panel on each application to set contacts and follow-up dates.
- Use the Follow-up section to copy templates and log activity (no emails are sent automatically).

## Pipeline Action Centre (v0.6.3)
- Open an application card in `/app/pipeline` to access follow-up templates, quick activity logging, and next-action reminders.

## Interview Lift loop (v0.6.4)
- Use the Interview Lift card on each application to add evidence, metrics, and STAR drafts after logging activity.
