-- Stage 1 ONLY. Neon/PostgreSQL 17. Run with a dedicated migration/owner connection.
-- Every business table in this migration has tenant_id (tenants.tenant_id identifies itself).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app;

DO $$ BEGIN
  CREATE TYPE app_user_role AS ENUM ('PLATFORM_OWNER','COMPANY_ADMIN','SALES','ACCOUNTANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tenants (
  tenant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  is_platform_tenant boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_single_platform_unique
  ON public.tenants (is_platform_tenant) WHERE is_platform_tenant = true;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE RESTRICT,
  email text NOT NULL CHECK (position('@' in email) > 1),
  full_name text NOT NULL CHECK (length(btrim(full_name)) > 0),
  role app_user_role NOT NULL,
  external_auth_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_ci_unique ON public.users (tenant_id, lower(email));
CREATE INDEX IF NOT EXISTS users_tenant_idx ON public.users (tenant_id);

-- A Platform Owner must belong to the special platform tenant.
CREATE OR REPLACE FUNCTION app.validate_user_tenant_role()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE platform_flag boolean;
BEGIN
  SELECT is_platform_tenant INTO platform_flag FROM public.tenants WHERE tenant_id=NEW.tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown tenant' USING ERRCODE='23503'; END IF;
  IF (NEW.role = 'PLATFORM_OWNER') IS DISTINCT FROM platform_flag THEN
    RAISE EXCEPTION 'Platform Owner must belong to platform tenant; others to company tenants'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS users_tenant_role_guard ON public.users;
CREATE TRIGGER users_tenant_role_guard BEFORE INSERT OR UPDATE OF role, tenant_id ON public.users
FOR EACH ROW EXECUTE FUNCTION app.validate_user_tenant_role();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tenant_runtime') THEN
    CREATE ROLE tenant_runtime NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

-- The migration principal may SET ROLE only for isolated security tests.
DO $$ BEGIN EXECUTE format('GRANT tenant_runtime TO %I', current_user); END $$;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;
REVOKE ALL ON FUNCTION app.current_tenant_id() FROM PUBLIC;
GRANT USAGE ON SCHEMA app, public TO tenant_runtime;
GRANT EXECUTE ON FUNCTION app.current_tenant_id() TO tenant_runtime;
GRANT USAGE ON TYPE app_user_role TO tenant_runtime;

REVOKE ALL ON public.tenants, public.users FROM PUBLIC;
GRANT SELECT ON public.tenants, public.users TO tenant_runtime;
-- No INSERT/UPDATE/DELETE grants to tenant_runtime in Stage 1.

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_runtime_read ON public.tenants;
CREATE POLICY tenant_runtime_read ON public.tenants
  FOR SELECT TO tenant_runtime USING (tenant_id = (SELECT app.current_tenant_id()));

DROP POLICY IF EXISTS tenant_runtime_read ON public.users;
CREATE POLICY tenant_runtime_read ON public.users
  FOR SELECT TO tenant_runtime USING (tenant_id = (SELECT app.current_tenant_id()));

-- Separate, highly privileged schema-owner provisioning path; NEVER use these credentials
-- in the web app. Platform Owner records DO NOT grant direct RLS bypass to runtime users.
DO $$
DECLARE schema_admin text := current_user;
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS migrations_admin ON public.tenants');
  EXECUTE format('CREATE POLICY migrations_admin ON public.tenants FOR ALL TO %I USING (true) WITH CHECK (true)', schema_admin);
  EXECUTE format('DROP POLICY IF EXISTS migrations_admin ON public.users');
  EXECUTE format('CREATE POLICY migrations_admin ON public.users FOR ALL TO %I USING (true) WITH CHECK (true)', schema_admin);
END $$;
