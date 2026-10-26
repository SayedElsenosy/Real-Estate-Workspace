# Phase 15 revision: direct managed accounts (no invitations)

## Flow

- **Platform Owner** signs into the existing Auth.js login and opens /admin/tenants. Creating a company requires the company name and the initial Company Admin's name, email and temporary password. Company + admin are inserted **atomically** with a unique tenant UUID + slug. Existing companies have an "Add admin" action.
- **Company Admin** opens /settings/users and directly creates SALES, ACCOUNTANT, or another COMPANY_ADMIN account with full name, email, role and temporary password. The user signs in immediately via /login; there are no signup/invite links or emails.
- The password is hashed with bcrypt (cost 12) on the server; the plaintext is not persisted or returned. A password is 12+ characters (<=72 UTF-8 bytes). Share temporary credentials out of band securely; a forced-first-login-password-change flow is **not yet implemented**.
- Accounts are stored in the existing users table; no second auth system. Auth.js Credentials reads the new record automatically through its existing authorizeCredentials and currentAuthUser callbacks.
- Tenant suspend/reactivate continues to work with the existing role-aware authorization.

## Database security

- Migration `db/migrations/0015_direct_account_provisioning.sql` must run AFTER 0013 and 0014. It revokes runtime execution of all invite-creation, invite-preview and invite-acceptance SQL functions and revokes the old tenant-only platform-create RPC.
- Historic `invitations` rows/table are retained to avoid destructive data changes; API/UI endpoints are removed. No new invitations can be issued by application logins.
- New functions `app.platform_create_company_with_admin`, `app.platform_create_company_admin`, `app.company_create_employee` have explicit role/tenant checks, database-side validated email/name/hash and no public grant. `auth_runtime` has no execution grants. The company manager RPC never accepts a target company ID; it uses the verified transaction-local tenant context.
- Identity actions are written to the append-only `audit_logs` table without storing email/password or password hash in the audit payload.
- Frontend APIs check the Auth.js session, role, same-origin POST, and validate inputs before executing tenant-scoped SQL RPCs. No privileged DB admin URL may be stored in Vercel.

## Rollout

1. Snapshot Neon production and apply 0015 from a trusted migration principal, e.g. `npm run db:migrate`. Confirm that 0013 and 0014 have already been applied.
2. Deploy the new code only AFTER the database migration is applied. No RESEND_API_KEY / INVITATION_FROM_EMAIL required.
3. The PLATFORM_OWNER account is bootstrapped once using the existing trusted operator-only script `npm run auth:create-platform-owner` (if not already created). Never put DATABASE_URL_ADMIN or any initial passwords in Vercel.
4. Visit /admin/tenants to create company+administrator; company managers use /settings/users to create employees. Test each role and tenant isolation with a dedicated test company.
5. CI SQL smoke test: `scripts/test-phase15-direct-accounts.mjs` (runs only on isolated foundation_test). Other Phase 16 audit and existing business suite remain unaffected.

**Not included:** bulk user provisioning, seat caps, MFA, user-edit/deactivation, first-login password rotation, company deletion. These are separate milestones.
