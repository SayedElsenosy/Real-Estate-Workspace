# Phase 7 — Customer Core / CRM

**Project:** [Project Name] (brand not selected)
**Scope:** Customer database, tenant isolation, CRM bookings, customer list and Customer 360.
**Date:** 2026-10-25

## Database
- `db/migrations/0006_customers.sql`: customers with tenant_id NOT NULL, contact fields, timestamp, unique (tenant_id, phone_primary), composite unique (tenant_id, id).
- `bookings.customer_id` added **nullable** to preserve historical booking rows without inventing customer identities. Existing customer_name and customer_phone remain immutable booking snapshots.
- Composite FK `bookings(tenant_id, customer_id) → customers(tenant_id,id)`.
- PostgreSQL ENABLE and FORCE RLS, runtime scoped CRUD; separate migration owner policy.
- Migration applied successfully to isolated Neon database; catalog verified RLS/force and FK. Existing production customer count remained zero after migration.

## Atomic Booking Flow
- `lib/bookings/create-booking.ts`: accepts **either** verified `customerId` or `newCustomer:{fullName,phonePrimary}`.
- Transaction-local tenant context and role check (SALES / COMPANY_ADMIN), then `SELECT ... FOR UPDATE` locks unit.
- Existing customer must match tenant; new customer inserted inside the SAME transaction with tenant-scoped phone uniqueness.
- Unit state updated BOOKED and booking CONFIRMED with customer_id and name/phone snapshots in same transaction.
- All changes roll back on error. Existing test still enforces one winner / nine conflicts.

## Frontend
- `components/workspace/booking-dialog.tsx`: existing customer search/select OR create new with name+phone.
- `components/workspace/inventory-client.tsx` forwards tenant-scoped customer data and updates the unit row optimistically **only after 201 CONFIRMED**.
- `app/(workspace)/customers/page.tsx`: customer table and live local text search by name/phone.
- `app/(workspace)/customers/[id]/page.tsx`: Customer 360 contact details, bookings and linked contracts, 404 for unavailable or cross-tenant customer.
- `components/workspace/sidebar.tsx`: CRM Customers navigation.
- Customer creation is deliberately restricted to booking transactions in this stage. Full standalone CRUD/edit workflows are future tasks.

## Verification
- Previous stage's PostgreSQL concurrency, financial precision, tenant RLS, and build tests retained.
- Playwright E2E: mock login → new customer+booking → inventory status BOOKED → customers list → Customer 360 → switch tenant and verify isolation.
- Separate workflow tests existing customer selection and second booking to avoid duplicate CRM row.
- **Limits:** Historical bookings do not automatically gain customer_id; backfill requires approved matching rules. National ID is sensitive; access must be governed by production permissions. No public mock login in production.
- Cheque clearing deferred per owner instruction. No stage beyond 7 started.
