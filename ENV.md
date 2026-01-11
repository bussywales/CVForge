# Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL from Settings > API.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon public key from Settings > API.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server-only, used by webhooks).
- `NEXT_PUBLIC_SITE_URL`: Base URL for redirects (local or production).
- `STRIPE_SECRET_KEY`: Stripe secret key from the Developers dashboard.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key (client-side use later).
- `STRIPE_WEBHOOK_SECRET`: Signing secret for the Stripe webhook endpoint.
- `STRIPE_CREDITS_PRICE_ID`: Stripe Price ID for the credits pack (£9 → 10 credits).
- `OPENAI_API_KEY`: OpenAI API key for autopack generation.
- `CVFORGE_ALLOW_NO_CREDITS`: Set to `true` to bypass credit checks in development.
