# Phase 16 — Internationalization, themes and audit

## Prerequisites and rollout
- next-intl supplies Arabic/English message dictionaries. Arabic is default.
- next-themes switches the HTML root class between light and dark, persisting the client's theme choice.
- The shared top toolbar controls language and theme. Language preference is an HTTP-only, SameSite=Lax cookie, and the document direction follows the locale.
- Apply db/migrations/0014_audit_logs.sql after 0013 using the trusted migration owner in an isolated Neon branch first. Never set DATABASE_URL_ADMIN on Vercel.
- The initial localization covers the principal navigation, dashboard cards and headings, primary page headings, login form, pagination and audit UI; remaining legacy error/dialog/page copy needs further extraction to message keys for full localization.
- Dark mode provides a legacy color compatibility layer, but visually test diagrams, special dialogs and advanced views in both themes.

## Audit
- PostgreSQL AFTER-row triggers run in the same transaction as business writes: a failed audit write rolls back the business change.
- Audit logs store tenant, optional user actor, operation, entity and JSONB before/after snapshots.
- The trigger is SECURITY DEFINER and executes as schema owner, with no audit INSERT/UPDATE/DELETE privileges granted to runtime roles.
- Database RLS and app.can_read_audit() restrict viewing to a verified active company administrator of the same tenant. The page limits reads to 25 rows.
- Server mutations set app.actor_id transaction-locally after verifying the actor. Trusted system/fixture writes record a NULL actor instead of inventing identities.
- Audited tables include projects, phases, buildings, units, customers, bookings, contracts, installments, receipts, receipt cheque events and contract templates.
- Passwords and invitation tokens are excluded. Contact PII and payment references are redacted from audit value snapshots; events still record changes to those values.
- Platform owner company-status RPCs and invitation mutations require separate platform-level audit integration in a later hardening pass.
- No tamper-evident hash chaining or external archival is included.

## Production rollout
1. Snapshot Neon production, apply migration 0014 in an isolated branch first, and verify migration 0013 is already applied.
2. Run tests, build and synchronize the npm lockfile.
3. Validate audit RLS, trace attribution, language/theme and existing business workflows in staging.
4. Apply the migration to production from a trusted operator terminal with direct, nonpooled owner credentials.
5. Deploy separately to Vercel once the database is ready.
