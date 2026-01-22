# Early Access invites (v0.8.31)

Use the ops allowlist + invite table to grant/revoke early access without redeploys. All flows are ops/admin/super_admin only; no raw emails are stored (hashed email only).

## Invite an email before signup
- Open `/app/ops/access`, search by email. If “User account: Not found” appears, click **Create invite**.
- After creation, copy the invite link or “Copy instructions” (pre-filled steps) and share with the user.
- Invites appear as “pending” until the user signs up/logs in with the same email; the gate auto-claims and allowlists them on first auth.

## Manage existing users
- If the user account exists, the Access card shows Allow/Blocked + source.
- Use **Grant access** / **Revoke access** for account-level allowlist updates (notes optional). Invites are best for users who have not signed up.

## Recent invites panel
- `/app/ops/access` lists the last ~20 invites with masked email hash prefixes, status (pending/claimed/revoked), invited/claimed timestamps, and quick actions (Copy link/Revoke/View dossier).

## Troubleshooting
- Email mismatch: revoke the invite and recreate with the exact email the user will sign up with (case-insensitive, hashed).
- Still blocked after invite: ask the user to sign out/in; confirm the email matches the invite; check if the invite is revoked/expired.
- Ops bypass: ops/admin/super_admin always pass the gate.
- Rate limits: access APIs are budgeted; if “Rate limited — try again shortly” appears, retry after the Retry-After seconds shown. Logging is best-effort and masked (hashedEmailPrefix only).
