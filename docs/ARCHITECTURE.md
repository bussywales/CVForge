# Architecture

## High-level view
- Next.js App Router provides UI routes, server actions, and route handlers.
- Supabase provides Auth, Postgres, and Row Level Security (RLS).
- Stripe powers credit purchases via webhook-driven ledger updates.
- OpenAI is used server-side for autopack generation only.
- DOCX import/export runs in nodejs runtime route handlers.
- Deterministic engines live in lib/role-fit.ts, lib/interview-lift.ts, lib/outreach-templates.ts, lib/submission-quality.ts, and lib/metrics-helper.ts.

## Data flow
1. Supabase SSR auth uses cookies and middleware to secure /app routes.
2. Server actions and API routes use the session-based Supabase client for user data.
3. RLS enforces user ownership across profiles, achievements, applications, and work history.
4. Service role access is used only for Stripe webhooks, admin pack publishing, and credit deductions.
5. Export routes render in-memory DOCX/ZIP responses and never store files.

## Admin learning flow
- Opt-in users generate anonymised learning events from job adverts.
- Proposals are reviewed in /app/admin/learning and published to domain_packs.
- Published packs are read by authenticated users and applied in Role Fit.

## Security model
- User data access relies on RLS policies (auth.uid() = user_id).
- Admin operations are gated by CVFORGE_ADMIN_EMAILS and use the service role key.
- Webhook writes bypass RLS using the service role key.
