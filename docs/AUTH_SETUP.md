# Auth.js v5 — Credentials authentication

## Implementation

- `auth.ts`: Auth.js v5 (`next-auth@5.0.0-beta.32`), DrizzleAdapter mapped to the existing `users` table; JWT sessions expire after four hours. Credentials are checked with bcryptjs (cost 12).
- `auth.config.ts`: shared edge-safe configuration. `middleware.ts` protects all URL prefixes in `app/(workspace)`; route groups themselves do not appear in URLs. Next.js 16 supports this filename with a deprecation warning; it is kept to match the requested middleware contract.
- `app/api/auth/[...nextauth]/route.ts`: Auth.js GET/POST handlers. Auth.js handles credential sign-in CSRF, encrypted HttpOnly session cookies and CSRF-protected sign-out. HTTPS production uses secure cookies automatically.
- `lib/auth/session.ts`: `getDatabaseSession()` reads `auth()`. Every business API uses this identity, with no bearer/header/body identity fallback. Cross-origin browser mutations are rejected.
- Business services still recheck tenant membership/roles inside RLS transactions, using existing external_auth_id from the verified database identity.
- Every server-side JWT read revalidates the user against the identity database. A trigger increments auth_version when password, active status, role, tenant or external identity changes. Old JWTs are rejected, including after a password reset or removal of password_hash. Client session updates cannot set role/tenant.
- Middleware validates the encrypted cookie without importing PostgreSQL at the edge; DB revalidation in pages/APIs is mandatory and also protects revoked sessions.
- A shared PostgreSQL counter limits each normalized email to ten attempts per fifteen minutes. Email identifiers are HMAC-hashed; errors do not disclose whether an account exists. Bcrypt's 72-byte input limit is enforced.

## Migration and restricted connections

Run `npm run db:migrate` from a trusted operator environment with `DATABASE_URL_ADMIN`. This adds `0012_auth.sql` after earlier migrations. Never expose the owner connection in the web service.

Use two **different non-owner, NOBYPASSRLS logins** on the same database:

| Setting | Role membership | Access |
| --- | --- | --- |
| DATABASE_URL | tenant_runtime | Tenant-scoped business tables and safe user identity columns |
| AUTH_DATABASE_URL | auth_runtime | Identity-only users/tenants reads, adapter tables and login attempts |

The auth role has an explicit RLS policy allowing identity lookup before the tenant is known; it cannot read bookings, contracts, receipts or inventory. It has no user provisioning/password-update grants. The business role cannot read password_hash or adapter tables. Keep both URLs server-only. Do not grant either login ownership, BYPASSRLS, or membership in the other role.

`npm run auth:create-runtime` creates `workspace_auth_runtime` from `AUTH_RUNTIME_PASSWORD` (24+ characters) with membership in auth_runtime. It refuses to overwrite an existing login. Set AUTH_DATABASE_URL to that login's connection URI.

Auth.js receives adapter tables `accounts`, `sessions`, `verification_tokens` with RLS FORCE and auth-only policies. JWT sessions do not write session rows; Credentials users are provisioned explicitly, never via OAuth/automatic signup. Additional providers require a separate tenant-aware provisioning design.

Credential-enabled emails are unique case-insensitively across companies because the login form accepts only email/password. Existing rows with NULL password_hash remain untouched and cannot sign in. A collision during credential provisioning fails; do not arbitrarily select another tenant's identity.

## First administrator

After provisioning an existing company, put these values into an operator-only `.env.local` (never commit it):

```dotenv
DATABASE_URL_ADMIN=<trusted migration/provisioning URL>
ADMIN_TENANT_ID=<existing company UUID>
ADMIN_EMAIL=<administrator email>
ADMIN_NAME=<administrator name>
ADMIN_PASSWORD=<unique password: at least 12 characters, no more than 72 UTF-8 bytes>
```

Run `npm run auth:create-admin`. It verifies the company exists and is not the platform tenant, hashes the password at cost 12, and inserts COMPANY_ADMIN with a unique external identity. Conflicts fail; it never resets an existing password or changes an existing role. It does not print credentials.

The web service needs only:

```dotenv
DATABASE_URL=<restricted business URI>
AUTH_DATABASE_URL=<restricted identity URI>
AUTH_SECRET=<cryptographically random secret, at least 32 characters>
AUTH_URL=https://your-real-host.example
```

Generate a secret with `openssl rand -base64 48`. Use HTTPS and the exact public origin in AUTH_URL. Set AUTH_TRUST_HOST only when the hosting reverse proxy sanitizes incoming host headers. Visit `/login`, enter the provisioned email/password. Company and role cannot be chosen by the visitor.

## Verification

`npm run typecheck`, `npm run build`, `npm run test:auth-rls`, and Playwright `e2e/auth.spec.ts` / `e2e/workspace.spec.ts`. CI uses ephemeral PostgreSQL, restricted runtime logins and bcrypt-backed test accounts. Security cases include invalid passwords, mock/bearer rejection, cookie tampering, sign-out, cross-site writes, role revocation and tenant isolation. The full workspace journey continues to cover bookings, contracts, payments, DOCX and cheque reversal.

Demo inventory is optional and only seeded with explicit DEMO_SEED_ALLOW on disposable databases. Set DEMO_ACCOUNT_PASSWORD to a test-only password before the seed. No mock login routes or mock-session.ts remain.

## Deployment status

Code changes do not apply migrations or create accounts in persistent Neon. Set the real connection settings and apply migrations before enabling the new login there. No real administrator password is shipped in the repository.
