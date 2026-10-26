-- Phase 15 revision: owner/company-managed accounts. Invitation delivery is disabled.
-- Run as the migration principal. Runtime database logins remain NOBYPASSRLS.
-- Old invitation records are deliberately retained for historical compatibility.
REVOKE EXECUTE ON FUNCTION app.create_invitation(uuid,text,public.app_user_role,text,timestamptz) FROM tenant_runtime;
REVOKE EXECUTE ON FUNCTION app.revoke_invitation(uuid,uuid) FROM tenant_runtime;
REVOKE EXECUTE ON FUNCTION app.invitation_preview(text),app.accept_invitation(text,text,text) FROM auth_runtime;
REVOKE EXECUTE ON FUNCTION app.platform_create_tenant(uuid,text,text) FROM tenant_runtime;

-- Common hash checks used in both paths: a complete bcrypt cost 12 hash generated
-- by the server, NOT password strings or client-supplied role assertions.
CREATE OR REPLACE FUNCTION app.validate_managed_credentials(p_email text,p_name text,p_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
BEGIN
  IF length(btrim(p_name)) NOT BETWEEN 2 AND 200 OR
    length(btrim(p_email)) NOT BETWEEN 5 AND 254 OR
    btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR
    p_hash !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$' THEN
    RAISE EXCEPTION 'INVALID_MANAGED_ACCOUNT' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.users WHERE lower(btrim(email))=lower(btrim(p_email))
      AND password_hash IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_REGISTERED' USING ERRCODE='23505';
  END IF;
END $$;

-- Both records are created in ONE transaction; a failure must never leave an orphan company.
CREATE OR REPLACE FUNCTION app.platform_create_company_with_admin(
 p_actor uuid,p_name text,p_slug text,p_admin_name text,p_email text,p_password_hash text)
RETURNS TABLE(tenant_id uuid,slug text,admin_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
DECLARE v_tenant uuid;v_admin uuid;
BEGIN
 IF NOT app.is_platform_actor(p_actor) THEN
   RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
 END IF;
 IF length(btrim(p_name)) NOT BETWEEN 2 AND 200 OR p_slug !~ '^[a-z0-9][a-z0-9-]{2,60}$' THEN
   RAISE EXCEPTION 'INVALID_COMPANY' USING ERRCODE='22023';
 END IF;
 PERFORM app.validate_managed_credentials(p_email,p_admin_name,p_password_hash);
 INSERT INTO public.tenants(name,slug,is_platform_tenant,is_active)
   VALUES(btrim(p_name),p_slug,false,true) RETURNING public.tenants.tenant_id INTO v_tenant;
 INSERT INTO public.users(tenant_id,email,full_name,role,external_auth_id,password_hash)
   VALUES(v_tenant,lower(btrim(p_email)),btrim(p_admin_name),'COMPANY_ADMIN',
          'credentials:'||gen_random_uuid()::text,p_password_hash)
   RETURNING id INTO v_admin;
 -- Audit contains ONLY safe metadata. Never store the password or its hash in audit logs.
 INSERT INTO public.audit_logs(tenant_id,user_id,action,entity_type,entity_id,new_values)
 VALUES (v_tenant,p_actor,'INSERT','tenants',v_tenant,
    jsonb_build_object('slug',p_slug,'name',btrim(p_name),'created_by','PLATFORM_OWNER'));
 INSERT INTO public.audit_logs(tenant_id,user_id,action,entity_type,entity_id,new_values)
 VALUES (v_tenant,p_actor,'INSERT','users',v_admin,
    jsonb_build_object('role','COMPANY_ADMIN','created_by','PLATFORM_OWNER'));
 RETURN QUERY SELECT v_tenant,p_slug,v_admin;
END $$;

-- Platform owner can provision another company administrator in an existing company.
CREATE OR REPLACE FUNCTION app.platform_create_company_admin(
 p_actor uuid,p_tenant uuid,p_name text,p_email text,p_password_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
DECLARE v_user uuid;
BEGIN
 IF NOT app.is_platform_actor(p_actor) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.tenants WHERE tenant_id=p_tenant
   AND is_platform_tenant=false AND is_active=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TENANT_NOT_FOUND_OR_INACTIVE' USING ERRCODE='P0002'; END IF;
 PERFORM app.validate_managed_credentials(p_email,p_name,p_password_hash);
 INSERT INTO public.users(tenant_id,email,full_name,role,external_auth_id,password_hash)
   VALUES(p_tenant,lower(btrim(p_email)),btrim(p_name),'COMPANY_ADMIN',
    'credentials:'||gen_random_uuid()::text,p_password_hash) RETURNING id INTO v_user;
 INSERT INTO public.audit_logs(tenant_id,user_id,action,entity_type,entity_id,new_values)
 VALUES(p_tenant,p_actor,'INSERT','users',v_user,
    jsonb_build_object('role','COMPANY_ADMIN','created_by','PLATFORM_OWNER'));
 RETURN v_user;
END $$;

-- Manager can provision ONLY company roles, and ONLY within the session-local tenant.
CREATE OR REPLACE FUNCTION app.company_create_employee(
 p_actor uuid,p_name text,p_email text,p_role public.app_user_role,p_password_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,app AS $$
DECLARE v_tenant uuid:=app.current_tenant_id();v_user uuid;
BEGIN
 IF NOT app.is_company_admin_actor(p_actor) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
 END IF;
 IF p_role IS NULL OR p_role NOT IN ('COMPANY_ADMIN','SALES','ACCOUNTANT') THEN
    RAISE EXCEPTION 'INVALID_COMPANY_ROLE' USING ERRCODE='22023';
 END IF;
 PERFORM 1 FROM public.tenants WHERE tenant_id=v_tenant
   AND is_platform_tenant=false AND is_active=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TENANT_NOT_FOUND_OR_INACTIVE' USING ERRCODE='P0002'; END IF;
 PERFORM app.validate_managed_credentials(p_email,p_name,p_password_hash);
 INSERT INTO public.users(tenant_id,email,full_name,role,external_auth_id,password_hash)
    VALUES(v_tenant,lower(btrim(p_email)),btrim(p_name),p_role,
      'credentials:'||gen_random_uuid()::text,p_password_hash)
    RETURNING id INTO v_user;
 INSERT INTO public.audit_logs(tenant_id,user_id,action,entity_type,entity_id,new_values)
 VALUES(v_tenant,p_actor,'INSERT','users',v_user,
   jsonb_build_object('role',p_role,'created_by','COMPANY_ADMIN'));
 RETURN v_user;
END $$;

REVOKE ALL ON FUNCTION app.validate_managed_credentials(text,text,text) FROM PUBLIC,tenant_runtime,auth_runtime;
REVOKE ALL ON FUNCTION app.platform_create_company_with_admin(uuid,text,text,text,text,text) FROM PUBLIC,auth_runtime;
REVOKE ALL ON FUNCTION app.platform_create_company_admin(uuid,uuid,text,text,text) FROM PUBLIC,auth_runtime;
REVOKE ALL ON FUNCTION app.company_create_employee(uuid,text,text,public.app_user_role,text) FROM PUBLIC,auth_runtime;
GRANT EXECUTE ON FUNCTION app.platform_create_company_with_admin(uuid,text,text,text,text,text),
 app.platform_create_company_admin(uuid,uuid,text,text,text),
 app.company_create_employee(uuid,text,text,public.app_user_role,text) TO tenant_runtime;
