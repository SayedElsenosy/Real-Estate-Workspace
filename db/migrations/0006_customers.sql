-- Phase 7 Customer Core. Keep historical booking snapshots and nullable customer_id.
CREATE TABLE IF NOT EXISTS public.customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE RESTRICT,
 full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 200),
 phone_primary text NOT NULL CHECK (length(btrim(phone_primary)) BETWEEN 6 AND 30),
 phone_secondary text,
 email text,
 national_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT customers_tenant_id_id_unique UNIQUE(tenant_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_phone_unique
 ON public.customers(tenant_id,phone_primary);
CREATE INDEX IF NOT EXISTS customers_tenant_name_idx ON public.customers(tenant_id,full_name);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customers' AND policyname='tenant_runtime_customer_crud') THEN
  CREATE POLICY tenant_runtime_customer_crud ON public.customers FOR ALL TO tenant_runtime
   USING (tenant_id=(SELECT app.current_tenant_id()))
   WITH CHECK (tenant_id=(SELECT app.current_tenant_id()));
 END IF;
END $$;
DO $$ DECLARE migrator text:=current_user; BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customers' AND policyname='migrations_admin') THEN
  EXECUTE format('CREATE POLICY migrations_admin ON public.customers FOR ALL TO %I USING(true) WITH CHECK(true)',migrator);
 END IF;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.customers TO tenant_runtime;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_id uuid;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bookings_tenant_customer_fk' AND conrelid='public.bookings'::regclass) THEN
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_tenant_customer_fk FOREIGN KEY(tenant_id,customer_id)
   REFERENCES public.customers(tenant_id,id) ON DELETE RESTRICT;
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS bookings_tenant_customer_idx ON public.bookings(tenant_id,customer_id);
