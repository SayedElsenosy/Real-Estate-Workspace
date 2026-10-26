-- Phase 15. Run exclusively as migration owner; NEVER in Vercel runtime.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE RESTRICT,
 email text NOT NULL CHECK (length(email) BETWEEN 5 AND 254),
 role public.app_user_role NOT NULL CHECK (role IN ('COMPANY_ADMIN','SALES','ACCOUNTANT')),
 token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 revoked_at timestamptz,
 created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT invitation_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS invitations_tenant_created_idx ON public.invitations(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invitations_pending_email_idx ON public.invitations(tenant_id, lower(email)) WHERE used_at IS NULL AND revoked_at IS NULL;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitations FROM PUBLIC, tenant_runtime, auth_runtime;
GRANT SELECT(id,tenant_id,email,role,expires_at,used_at,revoked_at,created_by,created_at) ON public.invitations TO tenant_runtime;
DROP POLICY IF EXISTS invitation_tenant_read ON public.invitations;
CREATE POLICY invitation_tenant_read ON public.invitations FOR SELECT TO tenant_runtime
 USING(tenant_id=(SELECT app.current_tenant_id()));
DO $admin_policy$ BEGIN
 EXECUTE format('DROP POLICY IF EXISTS migrations_admin ON public.invitations');
 EXECUTE format('CREATE POLICY migrations_admin ON public.invitations FOR ALL TO %I USING (true) WITH CHECK (true)',current_user);
END $admin_policy$;
GRANT SELECT (is_active) ON public.users TO tenant_runtime;
GRANT USAGE ON SCHEMA app TO auth_runtime;

-- SECURITY DEFINER functions use the migration principal (owner) and tightly validate
-- the authenticated application user's ID against the transaction-local tenant.
CREATE OR REPLACE FUNCTION app.is_platform_actor(p_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.users u JOIN public.tenants t ON t.tenant_id=u.tenant_id
 WHERE u.id=p_actor AND u.tenant_id=app.current_tenant_id()
   AND u.role='PLATFORM_OWNER' AND u.is_active AND t.is_platform_tenant AND t.is_active
 )
$$;
CREATE OR REPLACE FUNCTION app.is_company_admin_actor(p_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.users u JOIN public.tenants t ON t.tenant_id=u.tenant_id
 WHERE u.id=p_actor AND u.tenant_id=app.current_tenant_id()
   AND u.role='COMPANY_ADMIN' AND u.is_active AND NOT t.is_platform_tenant AND t.is_active
 )
$$;
REVOKE ALL ON FUNCTION app.is_platform_actor(uuid), app.is_company_admin_actor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.is_platform_actor(uuid),app.is_company_admin_actor(uuid) TO tenant_runtime;

CREATE OR REPLACE FUNCTION app.platform_tenants(p_actor uuid)
RETURNS TABLE(tenant_id uuid, name text, slug text, is_active boolean, users_count bigint, projects_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
BEGIN
 IF NOT app.is_platform_actor(p_actor) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT t.tenant_id,t.name,t.slug,t.is_active,
   (SELECT count(*) FROM public.users u WHERE u.tenant_id=t.tenant_id),
   (SELECT count(*) FROM public.projects p WHERE p.tenant_id=t.tenant_id)
 FROM public.tenants t WHERE NOT t.is_platform_tenant
 ORDER BY t.created_at DESC,t.tenant_id DESC;
END $$;

CREATE OR REPLACE FUNCTION app.platform_create_tenant(p_actor uuid,p_name text,p_slug text)
RETURNS TABLE(tenant_id uuid, slug text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
BEGIN
 IF NOT app.is_platform_actor(p_actor) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF length(btrim(p_name)) NOT BETWEEN 2 AND 200 OR p_slug !~ '^[a-z0-9][a-z0-9-]{2,60}$'
 THEN RAISE EXCEPTION 'INVALID_COMPANY' USING ERRCODE='22023'; END IF;
 RETURN QUERY INSERT INTO public.tenants(name,slug,is_platform_tenant,is_active)
   VALUES(btrim(p_name),p_slug,false,true)
   RETURNING public.tenants.tenant_id,public.tenants.slug;
END $$;

CREATE OR REPLACE FUNCTION app.platform_set_tenant_active(p_actor uuid,p_tenant uuid,p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
BEGIN
 IF NOT app.is_platform_actor(p_actor) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 UPDATE public.tenants SET is_active=p_active
 WHERE tenant_id=p_tenant AND NOT is_platform_tenant;
 IF NOT FOUND THEN RAISE EXCEPTION 'TENANT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
END $$;

CREATE OR REPLACE FUNCTION app.create_invitation(
 p_actor uuid,p_email text,p_role public.app_user_role,p_hash text,p_expires timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
DECLARE v_id uuid; v_tenant uuid:=app.current_tenant_id(); v_email text:=lower(btrim(p_email));
BEGIN
 IF NOT app.is_company_admin_actor(p_actor) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   OR length(v_email)>254 OR p_role NOT IN ('COMPANY_ADMIN','SALES','ACCOUNTANT')
   OR p_hash !~ '^[a-f0-9]{64}$'
   OR p_expires<=now() OR p_expires>now()+interval '7 days'
 THEN RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.tenants WHERE tenant_id=v_tenant AND is_active FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.users WHERE lower(btrim(email))=v_email AND password_hash IS NOT NULL)
 THEN RAISE EXCEPTION 'EMAIL_ALREADY_REGISTERED' USING ERRCODE='23505'; END IF;
 IF EXISTS(SELECT 1 FROM public.invitations
    WHERE tenant_id=v_tenant AND lower(email)=v_email AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now())
 THEN RAISE EXCEPTION 'PENDING_INVITATION' USING ERRCODE='23505'; END IF;
 INSERT INTO public.invitations(tenant_id,email,role,token_hash,expires_at,created_by)
 VALUES(v_tenant,v_email,p_role,p_hash,p_expires,p_actor) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION app.revoke_invitation(p_actor uuid,p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
BEGIN
 IF NOT app.is_company_admin_actor(p_actor) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 UPDATE public.invitations SET revoked_at=now()
 WHERE id=p_id AND tenant_id=app.current_tenant_id() AND used_at IS NULL AND revoked_at IS NULL;
END $$;

-- Called by the identity-only connection, with the SHA-256 digest of a random 32-byte URL token.
-- No direct SELECT/INSERT/UPDATE to invitations or users is granted to auth_runtime.
CREATE OR REPLACE FUNCTION app.invitation_preview(p_hash text)
RETURNS TABLE(email text,company_name text,role public.app_user_role,expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
 SELECT i.email,t.name,i.role,i.expires_at FROM public.invitations i
 JOIN public.tenants t ON t.tenant_id=i.tenant_id
 WHERE i.token_hash=p_hash AND i.used_at IS NULL AND i.revoked_at IS NULL
   AND i.expires_at>now() AND t.is_active AND NOT t.is_platform_tenant
$$;

CREATE OR REPLACE FUNCTION app.accept_invitation(p_hash text,p_name text,p_password_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
DECLARE i public.invitations%ROWTYPE; v_id uuid;
BEGIN
 SELECT * INTO i FROM public.invitations
 WHERE token_hash=p_hash AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE='P0002'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE tenant_id=i.tenant_id AND is_active AND NOT is_platform_tenant)
 THEN RAISE EXCEPTION 'INACTIVE_COMPANY' USING ERRCODE='42501'; END IF;
 IF length(btrim(p_name)) NOT BETWEEN 2 AND 200
  OR p_password_hash !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$'
 THEN RAISE EXCEPTION 'INVALID_USER' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.users WHERE lower(btrim(email))=i.email AND password_hash IS NOT NULL)
 THEN RAISE EXCEPTION 'EMAIL_ALREADY_REGISTERED' USING ERRCODE='23505'; END IF;
 INSERT INTO public.users(tenant_id,email,full_name,role,external_auth_id,password_hash)
 VALUES(i.tenant_id,i.email,btrim(p_name),i.role,'credentials:'||gen_random_uuid()::text,p_password_hash)
 RETURNING id INTO v_id;
 UPDATE public.invitations SET used_at=now() WHERE id=i.id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION app.platform_tenants(uuid),
 app.platform_create_tenant(uuid,text,text), app.platform_set_tenant_active(uuid,uuid,boolean),
 app.create_invitation(uuid,text,public.app_user_role,text,timestamptz),app.revoke_invitation(uuid,uuid),
 app.invitation_preview(text),app.accept_invitation(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.platform_tenants(uuid),app.platform_create_tenant(uuid,text,text),
 app.platform_set_tenant_active(uuid,uuid,boolean),app.create_invitation(uuid,text,public.app_user_role,text,timestamptz),
 app.revoke_invitation(uuid,uuid) TO tenant_runtime;
GRANT EXECUTE ON FUNCTION app.invitation_preview(text),app.accept_invitation(text,text,text) TO auth_runtime;
