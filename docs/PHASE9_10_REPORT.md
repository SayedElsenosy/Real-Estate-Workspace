# Phase 9 & 10 — Contracts, Treasury and Word Templates

## Implementation
- Phase 9: confirmed booking → contract creation using existing POST /api/contracts (COMPANY_ADMIN only); contract list, detail /contracts/[id], installment schedule, Decimal.js receipt totals, and payment dialog using POST /api/receipts. The client updates an installment to PAID immediately on success, then router.refresh() confirms DB state.
- Treasury: Cairo business-date receipts; overdue unpaid installments; pending cheques from explicit clearance status PENDING, excluding historical cheques with unknown status.
- Phase 10: migration 0007 creates contract_templates and generated_docx_url; migration 0008 stores private DOCX bytes with tenant RLS and <=5 MiB DB check; migration 0009 tracks new cheque clearance status.
- Admin upload UI /settings/contracts; sample DOCX download; upload POST /api/contract-templates validates DOCX and file size; POST /api/contracts/[id]/generate-docx fetches contract, booking, customer, unit, project, installments, and company-scoped active template. Outputs DOCX Buffer in memory as application/vnd.openxmlformats-officedocument.wordprocessingml.document.
- Word tags: {customer_name}, {customer_phone}, {unit_number}, {project_name}, {total_amount}, {installment_plan}. For repeated installments, put {#installments} and {/installments} around repeated table content; inner cells use {sequence}, {due_date}, {amount}. Refer to downloadable sample.
- Generated contracts are streamed as immediate responses without persistent file writes. generated_docx_url stays NULL for direct-download mode; it should only be set when an authenticated persistent object storage integration is configured.

## Authorization and boundaries
- Template upload and sample available to COMPANY_ADMIN; generation to COMPANY_ADMIN and ACCOUNTANT.
- RLS isolates both template metadata and BYTEA content by verified tenant ID. Upload and download endpoints reject cross-tenant access. No disk/public writes.
- Local mock login is disabled in production. Real identity provider and restricted runtime credentials remain prerequisites to public deployment.
- The cheque clearing settlement, bank reconciliation, cheque reversals and associated installment reconciliation are NOT implemented. Stage 9 adds a PENDING record only for new cheques; old receipts remain unclassified, never guessed.
- Do not treat recorded cheques as cleared bank funds. Earlier Stage 5 immediately marks CHEQUE installments PAID; this limitation persists and must be resolved before real financial operations.
- Tenant RLS and file upload constraints are exercised in disposable PostgreSQL within CI; migrations to the separate persistent Neon project are **not automatically deployed by GitHub Actions**.

## Test
- Playwright E2E creates customer/booking, issues active contract with installment schedule, records first installment, checks PAID status, downloads sample Word, uploads tenant-scoped template and downloads generated Word. Also tests inventory RLS, SVG booking and role restrictions.
- Source: e2e/mock-booking.spec.ts.
- Existing stage 1–8 PostgreSQL and TypeScript/Next.js build checks remain required.
- Last fully green run at time of initial implementation: https://github.com/SayedElsenosy/Real-Estate-Workspace/actions/runs/40238521742. See later runs for enhancements and latest validation.
