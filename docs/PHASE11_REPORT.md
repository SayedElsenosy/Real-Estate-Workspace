# Phase 11: Cheque lifecycle and aging reports

## Schema
- `db/migrations/0010_cheque_lifecycle.sql` creates PostgreSQL `cheque_clearance_status_enum`: PENDING, CLEARED, BOUNCED, and converts the existing status column.
- Non-cheque historical receipts become CLEARED. Historical cheque NULL statuses deliberately stay NULL (unknown): never assume they are pending or cleared.
- For new inserts, a PostgreSQL trigger sets PENDING for CHEQUE and CLEARED for CASH/BANK_TRANSFER.
- `bounced_reason` and `bounced_at` track reason/time; a CHECK constraint requires both when BOUNCED.
- Previous unique index on receipts per installment is replaced by a partial index excluding BOUNCED receipts, enabling a legitimate replacement payment without deleting the original receipt.
- Prior tenant isolation and FORCE RLS policies remain in force.

## Lifecycle API
- `lib/finance/process-cheque.ts` supports PENDING→CLEARED or PENDING→BOUNCED, guarded by COMPANY_ADMIN/ACCOUNTANT membership in same tenant.
- Uses one database transaction and lock order `contracts FOR UPDATE → receipts FOR UPDATE → installments FOR UPDATE`. A bounced installment moves PAID→OVERDUE with the cheque update in that transaction.
- Once CLEARED or BOUNCED, subsequent attempts return 409; repeated clicks cannot change a processed cheque.
- `POST /api/receipts/[id]/process-cheque` obtains server-verified JWT identity; JSON contains `new_status` and optional `reason`. Reason required for BOUNCED.
- BOUNCED cheque amounts are excluded from collected totals and active settlement aggregation. PENDING amounts are not treated as cleared in collected totals, but reserve the installment to prevent double-settlement.
- A pending cheque for a contract advance without a linked installment is marked bounced without an installment status update.

## UI
- `/treasury` lists PENDING cheques, with buttons to mark cleared and to bounce in a reason modal.
- `/reports/aging` uses Cairo local calendar dates and `Decimal.js` for the buckets 1–30,31–60,61–90,>90 days and overdue customer-level total, including PENDING installments whose due date is past. Paid installments and cancelled contracts are excluded.
- The treasurer's amount-collected totals include only CLEARED receipts.

## Test
- `e2e/mock-booking.spec.ts` adds a Chromium test: login → booking → contract → installment paid with cheque → treasury bounce reason → installment OVERDUE → aging report.
- No production identity deployment or automatic application of this migration to persistent Neon.
- No double-entry general ledger reversal or bank reconciliation module: an accountant should reconcile the receipt with bank statements before production use.
