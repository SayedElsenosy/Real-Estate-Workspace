# Auth provisioning — 26 October 2026

## Persistent Neon database

- Project: `Real-Estate-Workspace-Foundation` (`floral-shape-03190134`).
- Main branch: `br-quiet-lake-bao8jf71`; database: `real_estate_workspace`.
- Migration `0012_auth.sql` tested first on isolated branch `br-rough-cell-ba9kug9z`, then applied transactionally to main.
- Existing `users.is_active` discovered during preflight. Auth.js now respects that flag, and changing it increments auth_version to revoke old JWTs. The migration adds the flag on clean databases too.
- Created two separate NOBYPASSRLS, non-superuser SQL logins: `workspace_auth_runtime` (member of auth_runtime) and `workspace_runtime` (member of tenant_runtime).
- Verified: auth login can read identity data but has no bookings SELECT permission; business login cannot read password_hash. Passwords and AUTH_SECRET are never committed.
- Provisioned an initial company and COMPANY_ADMIN account with a bcrypt cost-12 hash. No mock inventory or financial fixtures were inserted into the persistent database.

## Application hosting

The owner explicitly authorized production deployment to Vercel and storage of the application runtime secrets there. The hosting project is independent of other repositories. Only the two restricted runtime connection strings and AUTH_SECRET are provided to the web service; the schema-owner connection and initial administrator password are excluded.

Production deployment and live sign-in checks are performed after successful CI. Connection values and passwords are excluded from this report and from git.
