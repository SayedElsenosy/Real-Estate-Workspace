CREATE TABLE IF NOT EXISTS public.contract_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 200),
 file_url text NOT NULL CHECK(length(btrim(file_url))>0),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT contract_templates_tenant_id_id_key UNIQUE(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS contract_templates_tenant_active_idx ON public.contract_templates(tenant_id,is_active);
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_templates' AND policyname='tenant_runtime_templates_crud') THEN
 CREATE POLICY tenant_runtime_templates_crud ON public.contract_templates FOR ALL TO tenant_runtime
 USING(tenant_id=(SELECT app.current_tenant_id())) WITH CHECK(tenant_id=(SELECT app.current_tenant_id()));
 END IF;
END $$;
DO $$ DECLARE migrator text:=current_user; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_templates' AND policyname='migrations_admin') THEN
 EXECUTE format('CREATE POLICY migrations_admin ON public.contract_templates FOR ALL TO %I USING(true) WITH CHECK(true)',migrator);
 END IF;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.contract_templates TO tenant_runtime;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS generated_docx_url text;
