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

## Supabase
- Run the SQL migration by following `supabase/README.md`.
- Configure auth redirect URLs to include your site URL and `/app`.

## Stripe
- Create a webhook endpoint at `/api/stripe/webhook` and add the signing secret.
- Use a Price ID for the credits pack in `STRIPE_CREDITS_PRICE_ID`.
