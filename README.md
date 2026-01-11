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

## How to use (Phase 1)
1. Sign in with a magic link at `/login`.
2. Visit `/app/profile` to update your profile and add achievements.
3. Create a new application at `/app/applications/new`.
4. Edit or delete applications from `/app/applications`.

## Phase 1 smoke test checklist
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Sign in via magic link and reach `/app`.
- Update profile fields and confirm the success banner.
- Add, edit, and delete an achievement.
- Create a new application and confirm redirect to the detail page.
- Edit an application and delete it from the list.

## Supabase
- Run the SQL migration by following `supabase/README.md`.
- Configure auth redirect URLs to include your site URL and `/app`.

## Stripe
- Create a webhook endpoint at `/api/stripe/webhook` and add the signing secret.
- Use a Price ID for the credits pack in `STRIPE_CREDITS_PRICE_ID`.
