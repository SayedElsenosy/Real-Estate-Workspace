# Phase 15 — Platform administration and invitations

## Security and environment

Migration: `db/migrations/0013_platform_invites.sql`. **Run it before deploying the new Auth.js code**, which reads tenants.is_active.
Never set DATABASE_URL_ADMIN, PLATFORM_OWNER_PASSWORD, ADMIN_PASSWORD, or AUTH_RUNTIME_PASSWORD in Vercel. Keep them in trusted operator-only local environments.
Both runtime PostgreSQL logins stay restricted and NOBYPASSRLS. Platform-only writes use audited, restricted SECURITY DEFINER functions checking the verified actor and tenant-local context.

## Production rollout

1. Snapshot/branch Neon production. From a trusted terminal using the **direct, non-pooled administrator URL**, run `npm ci` then `npm run db:migrate` (includes 0013).
2. To bootstrap the first real PLATFORM_OWNER, set local PLATFORM_OWNER_EMAIL, PLATFORM_OWNER_NAME, PLATFORM_OWNER_PASSWORD and run `npm run auth:create-platform-owner`. It refuses to overwrite an owner account.
3. Sign into /login with the Platform Owner, open /admin/tenants and create a company. A new Tenant UUID and collision-resistant Slug are generated.
4. A newly created company requires its initial Company Admin to be provisioned via the existing **operator-only** command `npm run auth:create-admin` using local ADMIN_TENANT_ID, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD. The admin can then use /settings/users.
5. Vercel Production settings: add RESEND_API_KEY, INVITATION_FROM_EMAIL (a verified Resend sender), ensure AUTH_URL is the canonical HTTPS origin and redeploy. The private Resend API key must be a server-only environment variable.
6. Sign in as Company Admin at /settings/users, invite a user and receive the email. The token-only URL /invite/[token] works for 72 hours; acceptance provisions credentials with bcrypt cost 12. The user signs in on /login after acceptance.

## Security properties and limitations

- Platform owner pages check role server-side. Tenants use an active flag; suspension immediately blocks new logins and invalidates an existing session on its next server-side identity revalidation, without deleting any company records.
- Invitations have RLS FORCE and no business/auth runtime direct INSERT/UPDATE privileges. Only the narrow SECURITY DEFINER RPCs create/revoke/accept them. Token SHA-256 hashes are stored, never plaintext tokens.
- The invite acceptance function atomically checks token availability/expiry, company status, duplicate credential emails, and creates the employee. Replay fails.
- Staff invites allow COMPANY_ADMIN, SALES, ACCOUNTANT (never PLATFORM_OWNER). No self-registration, privileged tenant creation from clients, or bypass of company RLS.
- Resend delivery failures revoke invitations; missing mail credentials return HTTP 503. A verified sender domain is required for general delivery.
- Platform Owner cannot automatically access another company's business data through its tenant: its dashboard lists only company summaries through a guarded database function.
- **Not included yet**: seats/subscription enforcement, invitation revocation UI, company deletion, ownership recovery, MFA, per-employee project permissions, full audit log pipeline.
- Never add third-party analytics on invite URLs without protecting bearer tokens. A referrer-policy header should remain set to no-referrer on these pages.
