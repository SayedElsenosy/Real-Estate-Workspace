# Phase 6 — Frontend Workspace (verified)

**Date:** 2026-10-25  
**Repo:** SayedElsenosy/Real-Estate-Workspace, main  
**Scope:** Frontend and development-only mock identity. No next phase started.

## User-facing routes

| Route | Purpose |
|---|---|
| /login | Choose one of two fixed mock tenants and COMPANY_ADMIN / SALES / ACCOUNTANT |
| /dashboard | Real project count, available inventory, active contract count and exact total sales |
| /projects | Project listing and navigation to that project's inventory |
| /inventory | Project → phase → building filters; unit table and booking modal |
| /bookings | Real, tenant-scoped bookings and customer details |
| /contracts | Real contracts and installment counts |
| /treasury | Real receipts and method labels |

## UI and authentication files

- `components/ui/{button,card,input,badge,table,dialog}.tsx`: shadcn-style source components; Radix dialog, Tailwind and Lucide.
- `components/workspace/{sidebar,page-header,login-form,inventory-client,booking-dialog,status-badge}.tsx`.
- `lib/auth/mock-session.ts`: HS256-signed local development JWT, SameSite=Strict HttpOnly cookie, local-host-only endpoints, automatically disabled when NODE_ENV=production.
- `app/api/dev/{login,logout}/route.ts`: local-only mock sessions, same-origin POST check.
- `lib/demo/demo-config.ts`: two fixed demo tenant IDs and role subjects.
- `scripts/{seed-demo,create-demo-runtime}.mjs`: guarded demo-only setup; rejects a non-demo DB and never touches production Neon.
- `lib/workspace/server-data.ts`: server-side membership check plus scoped transaction-local RLS reads.
- Existing booking, contracts, and receipts APIs accept verified local mock cookies in development and preserve production JWKS Bearer JWT validation.
- `app/(workspace)/inventory/page.tsx`: database-driven inventory, no fake inventory data.

## Booking button integration

1. Select an available unit in `inventory-client.tsx` and open `booking-dialog.tsx`.
2. Submit customer name and phone by `fetch("/api/bookings", {method:"POST", credentials:"same-origin", ...})`.
3. Existing API validates signed identity and role in `users`, performs atomic `SELECT ... FOR UPDATE` and DB transaction.
4. On successful CONFIRMED booking, change the selected unit to BOOKED immediately in React state, then `router.refresh()`.
5. A failure displays the server error in an accessible `role=alert` and leaves row unchanged.

## Verified CI

GitHub Actions run: https://github.com/SayedElsenosy/Real-Estate-Workspace/actions/runs/40227986003

Both jobs successful:
- Existing PostgreSQL phase 1–5 isolation, atomic booking, contract Decimal arithmetic, payments concurrency tests, TypeScript, Next.js build.
- Playwright Chromium full browser test: local login → dashboard → inventory → booking modal → CONFIRMED booking → BOOKED status and hidden Book button → bookings list → switch to second tenant → no first-tenant booking leaks.
- Second browser test: ACCOUNTANT can read inventory but cannot book.

Visual artifacts (actual test browser screenshots):
https://github.com/SayedElsenosy/Real-Estate-Workspace/actions/runs/40227986003/artifacts/12611559098

## Limitations and explicit security restrictions

- Mock sign-in is for **localhost and development only**, never publicly deployed.
- A real identity provider, a safe production session, authorized company provisioning, API rate limits and operational audit logging must be configured before public use.
- No public preview URL or live hosted app deployed. The verified visual preview is available as GitHub Actions screenshots.
- Payment cheque clearance and bounced cheques remain deferred.
- The demo inventory is seeded only in disposable `foundation_test` or `*_demo` PostgreSQL DBs and is not added to real customer data.
- Branding remains `[Project Name]`.
- Any future phase needs the user's explicit approval.
