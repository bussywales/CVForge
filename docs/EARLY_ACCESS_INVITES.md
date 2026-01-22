# Early Access invites (v0.8.28+)

Use the ops allowlist to grant or revoke early access without redeploys. All flows are ops/admin/super_admin only.

## Grant/revoke via UI
- Open `/app/ops/access`, search by email or UUID (min 3 chars), click “Manage access”.
- Status badge shows current allow/blocked state and source (ops bypass, DB allowlist, env allowlist).
- Add an optional note, then click **Grant access** or **Revoke access**. A calm confirmation appears; errors show with requestId.
- “Open dossier” deep-links to the user page for extra context.

## Pre-allowlist before signup
- From `/app/ops/access`, search by email. If they haven’t signed up, use their expected email/UUID from auth to create the record.
- Granting before signup still works: the DB record is checked first, then env allowlist, then blocked.

## Troubleshooting
- Email mismatch: confirm the auth email matches the invite; revoke + re-grant with the correct UUID if needed.
- Stuck blocked: ask the user to sign out/in to refresh session; if still blocked, check DB allowlist and env vars.
- Ops bypass: ops/admin/super_admin always pass the gate even if not on the allowlist.
- Rate limits: the access APIs are rate-limited; if you see “Rate limited — try again shortly” wait for the Retry-After seconds shown.
