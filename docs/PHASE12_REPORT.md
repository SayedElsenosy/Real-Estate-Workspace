# Phase 12 — Hardening Sprint

## Status and scope
Implemented on the independent Real-Estate-Workspace repository `main`; not related to BUNYRA repos. Tested in disposable GitHub Actions PostgreSQL; **persistent Neon database was not migrated or altered**.

## 1. Append-only financial receipts
- Migration `db/migrations/0011_secure_receipts.sql` revokes `UPDATE,DELETE` privileges on `public.receipts` from `tenant_runtime`; `SELECT,INSERT` remain. A BEFORE UPDATE OR DELETE trigger additionally blocks privileged row modifications.
- Existing receipts (including cheque details) remain immutable historical snapshots.
- `public.receipt_cheque_events` stores separate append-only CLEARED/BOUNCED events with recorded_at and reason, tenant-qualified composite FK and RLS + FORCE RLS.
- `processChequeStatus` writes an event and changes an installment to OVERDUE atomically, without UPDATE receipts. Contract locking serializes lifecycle operations, avoiding FOR UPDATE on immutable receipts.
- Active-installment payment uniqueness now takes cheque events into account. A BEFORE INSERT trigger uses a transaction-scoped advisory lock plus existence check, permitting a replacement receipt after a bounced event and preventing double settlement.
- `recordPayment`, collected totals and the treasury UI use effective cheque state derived from those events. Pending cheques are not counted as cleared cash.
- A compensating receipt creation workflow and general-ledger reversing journal remain **out of scope**. Immutable records are never erased to repair accounting mistakes.

## 2. Booking and unit lifecycle
- `POST /api/bookings/[id]/cancel`: verifies JWT and tenant membership; currently COMPANY_ADMIN only. Checks CONFIRMED booking, rejects an active/non-cancelled linked contract with HTTP 409, locks booking and unit, then updates booking CANCELLED + unit AVAILABLE in one transaction.
- `createSignedContract` updates the unit to SOLD in the same contract-and-installments transaction, preventing orphan 'sold' status on rollback. Existing-contract checks occur before unit status validation to preserve idempotent conflict semantics.
- `/bookings` includes cancellation confirmation UI; the user sees an error when a contract must be cancelled first.

## 3. Cairo dates
- `lib/utils/date.ts` exports `businessDate(date:Date|string)`, returning YYYY-MM-DD using `Intl.DateTimeFormat` with Africa/Cairo and formatToParts for safe ISO ordering.
- Date-only strings are preserved; ISO timestamps are rendered in Cairo business date.
- Installments use the Cairo signing date and calendar-month clamping (January 31 -> February 28/29).
- Existing dates in booking/customer UIs, receipts and treasury/aging report use this centralized logic.

## 4. Inventory creation
- `/inventory/manage` contains four connected forms: create project, create phase under project, create building under phase, create available unit under building.
- New endpoints `POST /api/projects`, `/api/phases`, `/api/buildings`, `/api/units` share strict JSON shape validation, tenant identity from JWT (never body), role check and project/phase/building tenant scoped parents.
- COMPANY_ADMIN may create records; SALES and ACCOUNTANT are read-only for inventory mutation. Inventory RLS and composite parent FKs enforce isolation independently of UI.
- Decimal area and price are strings validated to 2dp, not JS float for financial computation.

## 5. UX
- Workspace `loading.tsx` and `error.tsx` show Arabic accessible loading and retry states.
- Inventory and projects link to inventory management for COMPANY_ADMIN.

## Tests
- `scripts/test-secure-receipts.mjs` checks runtime privileges and protection triggers; UPDATE/DELETE fail with PostgreSQL 42501.
- `scripts/test-business-date.mjs` checks Cairo midnight boundaries and month-end installments.
- `e2e/mock-booking.spec.ts` verifies inventory creation, booking cancellation and unit AVAILABLE, forbids sales writes, confirms signed contract SOLD and cancellation HTTP 409.
- Existing foundation tests cover RLS, concurrency and contract rollback. GitHub Actions artifacts capture browser screenshots.
- **Deployment note:** Migration 0011 must be executed by authorized migration principal after 0001–0010. Never run tests or seed scripts against customer/production databases.

## 2026-10-26 independent audit and additional hardening

The five requested Phase 12 feature groups were already present on `main` before this audit. The audit found and fixed an **unsafe migration-replay edge case**: after a cheque bounces, a new receipt can settle the same installment, but replaying the legacy stage 5/10 uniqueness index would have blocked that valid replacement. Both `0005_receipts.sql` and `0010_cheque_lifecycle.sql` now skip creating the legacy index when the stage 11 `receipt_cheque_events` table exists. The stage 11 event-aware INSERT guard remains authoritative.

Test additions:
- Browser scenario now re-pays a bounced installment using a new CASH receipt without modifying the bounced receipt.
- CI E2E job replays all migrations **after** the browser cheque-repayment scenario, catching index regressions.
- `scripts/test-append-only-records.mjs` performs actual UPDATE and DELETE attempts on existing receipts and cheque-resolution events and expects the immutable trigger to reject each action.
- Browser test verifies SALES cannot call the administrator-only cancellation API.
- `scripts/test-business-date.mjs` now tests offset-aware timestamps and rejects timezone-ambiguous / invalid dates; `businessDate` enforces these inputs.
- Workspace error page no longer claims that a failed render necessarily rolled back a successful mutation.

### Verification boundary
The last observed Phase 12-era **green workflow run** is [40246736509](https://github.com/SayedElsenosy/Real-Estate-Workspace/actions/runs/40246736509), at the earlier `0011_secure_receipts.sql` commit. Later runs (including all commits in this audit) show both jobs failing **before any step executes**, with no runner allocated and no logs; therefore no green verification of the new test suite is claimed. This is an Actions execution blocker, not a reported failing assertion or SQL traceback. Re-run the latest workflow after GitHub Actions runner access is restored and inspect the first actionable failure if any.

Read-only Neon inspection of `real_estate_workspace` found `contract_templates` and `contract_template_files` present, but `receipt_cheque_events` absent. Thus **do not assume the append-only cheque event schema and the Phase 12 migration have been applied to persistent Neon**. This audit did not change persistent Neon data/schema; apply the authorized migrations in a controlled deployment and verify permissions, RLS and trigger presence before enabling production traffic.
