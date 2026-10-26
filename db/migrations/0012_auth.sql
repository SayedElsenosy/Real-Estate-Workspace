-- Run only with the trusted migration principal, never the web runtime.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 1;
-- Email/password alone must identify exactly one credential-enabled account.
-- Existing tenant-scoped email identities without passwords are preserved.
CREATE UNIQUE INDEX IF NOT EXISTS users_credentials_email_ci_unique
 ON public.users (lower(btrim(email))) WHERE password_hash IS NOT NULL;
CREATE OR REPLACE FUNCTION app.invalidate_user_sessions() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF NEW.password_hash IS DISTINCT FROM OLD.password_hash OR NEW.role IS DISTINCT FROM OLD.role
 OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.external_auth_id IS DISTINCT FROM OLD.external_auth_id THEN
  NEW.auth_version := OLD.auth_version + 1;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS users_auth_version ON public.users;
CREATE TRIGGER users_auth_version BEFORE UPDATE ON public.users
 FOR EACH ROW EXECUTE FUNCTION app.invalidate_user_sessions();

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='auth_runtime') THEN
  CREATE ROLE auth_runtime NOLOGIN NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO auth_runtime;
GRANT USAGE ON TYPE public.app_user_role TO auth_runtime;
-- Auth can look up identity before a tenant is known, but has no business-table grants.
GRANT SELECT ON public.users, public.tenants TO auth_runtime;
DROP POLICY IF EXISTS auth_identity_read ON public.users;
CREATE POLICY auth_identity_read ON public.users FOR SELECT TO auth_runtime USING (true);
DROP POLICY IF EXISTS auth_identity_read ON public.tenants;
CREATE POLICY auth_identity_read ON public.tenants FOR SELECT TO auth_runtime USING (true);
-- Never expose password hashes via the business runtime connection.
REVOKE SELECT ON public.users FROM tenant_runtime;
GRANT SELECT (id,tenant_id,email,full_name,role,external_auth_id,created_at) ON public.users TO tenant_runtime;

CREATE TABLE IF NOT EXISTS public.accounts (
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 type text NOT NULL, provider text NOT NULL, provider_account_id text NOT NULL,
 refresh_token text, access_token text, expires_at integer, token_type text,
 scope text, id_token text, session_state text,
 PRIMARY KEY(provider,provider_account_id)
);
CREATE INDEX IF NOT EXISTS accounts_user_idx ON public.accounts(user_id);
CREATE TABLE IF NOT EXISTS public.sessions (
 session_token text PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 expires timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON public.sessions(user_id);
CREATE TABLE IF NOT EXISTS public.verification_tokens (
 identifier text NOT NULL, token text NOT NULL, expires timestamptz NOT NULL,
 PRIMARY KEY(identifier,token)
);
-- Shared across instances: at most 10 password attempts/email per 15-minute window.
CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
 key text PRIMARY KEY, window_start timestamptz NOT NULL, attempts integer NOT NULL CHECK(attempts>0)
);
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['accounts','sessions','verification_tokens','auth_login_attempts'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, tenant_runtime',tbl);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO auth_runtime',tbl);
  EXECUTE format('DROP POLICY IF EXISTS auth_only ON public.%I',tbl);
  EXECUTE format('CREATE POLICY auth_only ON public.%I FOR ALL TO auth_runtime USING(true) WITH CHECK(true)',tbl);
  EXECUTE format('DROP POLICY IF EXISTS migrations_admin ON public.%I',tbl);
  EXECUTE format('CREATE POLICY migrations_admin ON public.%I FOR ALL TO %I USING(true) WITH CHECK(true)',tbl,current_user);
 END LOOP;
END $$;
