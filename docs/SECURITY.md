# Stage 1 Security and RLS

## Isolation model

- Tables: tenants(tenant_id PK), users(tenant_id FK NOT NULL). Every table defined here has tenant_id.
- Both tables ENABLE and FORCE ROW LEVEL SECURITY. For tenant_runtime, the *only* policy is SELECT where tenant_id = app.current_tenant_id().
- app.current_tenant_id() uses a transaction-local app.tenant_id value. Missing tenant context yields NULL and **zero** rows. A malformed UUID causes an error (fail closed).
- tenant_runtime is **NOLOGIN / NOBYPASSRLS**, SELECT only: no provisioning, cross-company administration, role updates or deletes.
- Create a separate database LOGIN (e.g. workspace_runtime) with a random strong password, grant it membership in tenant_runtime, **and no membership in the schema owner / admin role**. Example, as Neon migration owner:
  ```sql
  CREATE ROLE workspace_runtime LOGIN PASSWORD '<GENERATE_A_NEW_RANDOM_SECRET>' NOBYPASSRLS;
  GRANT tenant_runtime TO workspace_runtime;
  ```
- Put its Neon connection URI in server-only DATABASE_URL. The schema owner connection is used **only** for migrations / controlled provisioning, never for a running Next.js server or untrusted requests.
- The migrator has an explicit migrations_admin policy on both tables; that authority must not be exposed to the app runtime. This is intentionally separate from a PLATFORM_OWNER database record.
- `PLATFORM_OWNER` is a record role, not a SQL RLS override. The unique `is_platform_tenant` company represents the internal platform; a trigger ensures only its users can have that role.
- Auth is deliberately NOT enabled in phase 1: no API should accept tenant_id from a client. Later auth must verify session identity, company membership and permissions **before** withTenantTransaction().
- `set_config('app.tenant_id', uuid, true)` is ONLY safe inside the transaction; the same DB transaction must run the corresponding reads. Do NOT use connection-scoped SET with a pooled connection.
- PostgreSQL session settings can be set by anyone holding SQL credentials. Treat database URLs as privileged server secrets and prevent raw-SQL or untrusted query execution. RLS does not replace authentication or SQL-injection prevention.

## Verification

`npm run db:migrate` with DATABASE_URL_ADMIN applies the idempotent migration.
`TEST_DATABASE_URL_ADMIN=<disposable DB owner URL> npm run test:rls` proves tenant A cannot see B in BOTH tables, missing context fails closed, and tenant_runtime lacks write grants. Test fixtures are rolled back; the test never targets production.
The GitHub Actions workflow uses an ephemeral PostgreSQL 17 service for migration + RLS testing. Production Neon remains separate and must be checked independently.

## Deferred security work

- Identity provider/session validation with CSRF protection and secure cookies
- Platform administrative APIs, invitation/account provisioning and audit logging
- Backups, encrypted file storage, rate limiting, structured security logs
- Dedicated app DB role credentials in Vercel/Netlify secrets

## Stage 2 inventory isolation (2026-10-25)

- Every inventory table has a mandatory `tenant_id` with tenant-scoped indexes.
- `projects` belongs to its tenant; `phases`, `buildings`, and `units` enforce composite foreign keys `(tenant_id, parent_id)` preventing cross-tenant references even with valid UUIDs.
- ENABLE + FORCE RLS on projects, phases, buildings, units.
- Single `FOR ALL` tenant_runtime policy specifies both USING and WITH CHECK bound to `app.current_tenant_id()`.
- tenant_runtime gets SELECT, INSERT, UPDATE, DELETE on inventory only. Users and tenants remain SELECT-only. Role-level grants do not provide login or verified tenant identity.
- `units.price` and `units.area` use NUMERIC(12,2); Drizzle returns strings, and monetary calculations must never use JS floating-point numbers.
- `svg_coordinates` is optional JSON object for later validated geometry; no maps or placeholder geometries inserted.
- `scripts/test-inventory-rls.mjs` tests CRUD grants, missing tenant_id, read/update/delete isolation, and cross-tenant composite FK rejection in a rollback transaction.
- No user-facing CRUD API is exposed before a trusted authenticated user/tenant authorization layer exists.

## Stage 4 Contracts & Installments

- Contract/Installment composite FKs include tenant_id, enforced by unique (tenant_id,id) booking and contract keys.
- RLS ENABLE and FORCE on both tables; runtime CRUD scoped by transaction-local tenant_id.
- Contracts only sign when booking is CONFIRMED, unit is BOOKED and signed-in actor is COMPANY_ADMIN, with unit row price snapshot and immutable plan snapshot.
- Monetary operations use Decimal.js and strings; scale always NUMERIC(12,2) in PostgreSQL.
- One transaction inserts signed ACTIVE contract plus all installment rows; any error rolls back the contract.
- Current policy rejects contract total differing from approved unit price; discounts need a separate approval flow.
- HTTP API remains fail-closed without trusted JWT issuer and restricted runtime DATABASE_URL.

## Stage 5 Receipts and Treasury

- `receipts` includes tenant_id NOT NULL. RLS ENABLE + FORCE with runtime CRUD and migration owner-only policy.
- Composite receipt FK to `installments(tenant_id,contract_id,id)` blocks referencing another contract's installment, even in the SAME tenant.
- `recordPayment` locks contract then installment (FOR UPDATE) in a single transaction, requires authenticated ACCOUNTANT or COMPANY_ADMIN. Installment must be PENDING or OVERDUE and amount EXACT.
- Receipt insert and installment status update roll back together on failures (e.g. duplicate transfer references).
- Receipts per contract cannot exceed total contract price; all money comparisons use exact Decimal and database NUMERIC.
- Non-cash reference required and unique per tenant/method; one full settlement receipt per installment.
- `installment_id=NULL` is an unallocated advance: does NOT mark any installment PAID; no automatic allocation to down payment installments.
- **Business limitation:** recording a CHEQUE immediately marks installment PAID but does NOT verify clearing or handle bounced instruments. This simplification is unsuitable for actual cash accounting until bank-clearance and reversal workflows are implemented.
- No end-to-end live JWT authentication or production deployment configured; HTTP endpoints fail closed without trusted issuer and restricted runtime credentials.
