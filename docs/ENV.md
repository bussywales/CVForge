# Environment notes (RBAC + Ops)

- Ops access now uses database roles; env overrides (`OPS_ADMIN_EMAILS`, `OPS_ADMIN_DOMAIN`) are break-glass only when no explicit role row exists.

## RBAC bootstrap

Run this after the RBAC migration to promote your account to super_admin:

```sql
insert into public.user_roles (user_id, role)
values ('<founder-user-id>', 'super_admin')
on conflict (user_id) do update set role = excluded.role;
```
