# CVForge Product Spec

## MVP
- Email magic link auth with Supabase SSR sessions.
- Profile, achievements, and applications CRUD with server-side validation.
- Stripe checkout + webhook to ledger credits and store event history.
- Audit-friendly data model for CV achievements and application history.

## Non-goals (Phase 1)
- No AI generation or scoring yet.
- No team collaboration, recruiters, or job board integrations.
- No complex billing (subscriptions, invoices, coupons) beyond a single credits pack.

## Trust Rules
- User data stays in the owner’s workspace; no third-party sharing by default.
- Credits are only mutated by verified Stripe events or explicit admin actions.
- Every payment event is recorded once; idempotency is enforced.
- All secrets stay server-side; only public keys are exposed to the client.
