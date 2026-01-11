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
4. Edit or delete applications from `/app/applications`.
5. Open an application and generate an autopack.
6. Edit the autopack content and save changes.

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
- Configure auth redirect URLs to include your site URL and `/app`.
- Magic-link auth completes at `/auth/callback`, so ensure `${NEXT_PUBLIC_SITE_URL}/auth/callback` is in your redirect allowlist.

## Stripe
- Create a webhook endpoint at `/api/stripe/webhook` and add the signing secret.
- Use a Price ID for the credits pack in `STRIPE_CREDITS_PRICE_ID`.

## OpenAI (Phase 2)
- Set `OPENAI_API_KEY` to enable autopack generation.
- Optional: set `CVFORGE_ALLOW_NO_CREDITS=true` to bypass credit checks in development.
