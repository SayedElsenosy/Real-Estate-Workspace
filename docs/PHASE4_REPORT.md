# المرحلة الرابعة — Contracts & Installments

**Date:** 2026-10-25
**Repository:** SayedElsenosy/Real-Estate-Workspace (main)
**Scope:** contracts/installments only — no next phase was started.

## Delivered
- db/migrations/0004_contracts.sql: contract_status, installment_status, contracts, installments with tenant_id NOT NULL, composite FKs, two enforced RLS policies per table and runtime CRUD grants.
- bookings(tenant_id, id) was given a unique index so PostgreSQL accepts the tenant-scoped FK from contracts.
- Total, unit-price snapshot, and installment amounts are NUMERIC(12,2). Plan snapshot is saved as JSONB with each contract.
- lib/contracts/generate-installments.ts: Decimal.js only for money; HALF_UP for regular installments and any piaster difference assigned to the FINAL installment.
- lib/contracts/create-contract.ts: verified tenant and COMPANY_ADMIN membership, row locking on booking and unit, confirmed booking check, price snapshot validation and contract/installments inserted in the SAME transaction. In case of any failure, all inserts roll back.
- app/api/contracts/route.ts: POST; fail-closed until externally trusted JWT identity provider and restricted DB credentials are configured, never trusts tenant_id in body.
- scripts/test-installments-math.mjs: confirms 1000000.01 = 333333.34 + 333333.34 + 333333.33. Also tests 20 percent down + six quarterly installments, exact sum, invalid plans and dates.
- scripts/test-contracts-transaction.mjs: PostgreSQL CI integration tests duplicate-signing prevention, 3 persisted installments exact total, tenant spoofing rejection, price override rejection and no orphan contract on invalid schedule after INSERT.

## Verified
- GitHub Actions **success**: https://github.com/SayedElsenosy/Real-Estate-Workspace/actions/runs/40220276866
  - PostgreSQL 17 migration, stage 1/2/3 tests, new stage 4 math and transaction tests, TypeScript check, Next.js build.
- Neon project **floral-shape-03190134**, DB **real_estate_workspace**: migration executed successfully. PostgreSQL catalog verified that contracts and installments have both ENABLE and FORCE RLS and two policies each.
- Real fixture calculations were verified in disposable PostgreSQL CI; NOT run against actual customer data.
- No source changes in BUNYRA-New or Cairo-Plaza-Web.

## Deliberate limitations
- An HTTP end-to-end test with a live JWT issuer is not yet in place; the API fails closed without verified identity and server-side restricted DB credentials.
- This version creates signed ACTIVE contracts immediately on a verified request; DRAFT is a table default reserved for future drafting workflows.
- Expires-at booking does NOT automatically release its unit.
- Contract amount MUST equal the approved unit price until an explicit pricing/discount approval workflow exists.
- Full customer lifecycle, payment collection, cancellation and tax/legal approvals are outside stage 4.

**Stop here until the user explicitly approves the next stage.**
