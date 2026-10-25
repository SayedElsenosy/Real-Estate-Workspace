-- 0004_contracts.sql — Stage 4: tenant-safe contract signatures and exact installments.
-- The composite booking FK requires a non-partial unique index on (tenant_id,id).
-- Migrations must run as the same dedicated OWNER used for stages 1–3.

DO $$ BEGIN
  CREATE TYPE public.contract_status AS ENUM ('DRAFT','ACTIVE','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.installment_status AS ENUM ('PENDING','PAID','OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_tenant_id_id_key
  ON public.bookings (tenant_id, id);

CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount > 0),
  unit_price_snapshot numeric(12,2) NOT NULL CHECK (unit_price_snapshot > 0),
  payment_plan_snapshot jsonb NOT NULL
    CHECK (jsonb_typeof(payment_plan_snapshot) = 'object'),
  status public.contract_status NOT NULL DEFAULT 'DRAFT',
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contracts_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT contracts_tenant_booking_unique UNIQUE (tenant_id, booking_id),
  CONSTRAINT contracts_booking_tenant_fk FOREIGN KEY (tenant_id, booking_id)
    REFERENCES public.bookings (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT contracts_active_requires_signed_at_check
    CHECK (status <> 'ACTIVE' OR signed_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE RESTRICT,
  contract_id uuid NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  is_down_payment boolean NOT NULL DEFAULT false,
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status public.installment_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT installments_contract_tenant_fk FOREIGN KEY (tenant_id, contract_id)
    REFERENCES public.contracts (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT installments_contract_sequence_unique
    UNIQUE (tenant_id, contract_id, sequence)
);

CREATE INDEX IF NOT EXISTS contracts_tenant_status_idx
  ON public.contracts (tenant_id, status);
CREATE INDEX IF NOT EXISTS installments_tenant_due_status_idx
  ON public.installments (tenant_id, due_date, status);
CREATE INDEX IF NOT EXISTS installments_tenant_contract_idx
  ON public.installments (tenant_id, contract_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments FORCE ROW LEVEL SECURITY;

DO $$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['contracts','installments'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=relation_name
        AND policyname='tenant_runtime_contract_crud'
    ) THEN
      EXECUTE format(
        'CREATE POLICY tenant_runtime_contract_crud ON public.%I
          FOR ALL TO tenant_runtime
          USING (tenant_id = (SELECT app.current_tenant_id()))
          WITH CHECK (tenant_id = (SELECT app.current_tenant_id()))',
        relation_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE relation_name text;
DECLARE migrator text := current_user;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['contracts','installments'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=relation_name
        AND policyname='migrations_admin'
    ) THEN
      EXECUTE format(
        'CREATE POLICY migrations_admin ON public.%I
         FOR ALL TO %I USING (true) WITH CHECK (true)',
        relation_name, migrator
      );
    END IF;
  END LOOP;
END $$;

GRANT USAGE ON TYPE public.contract_status, public.installment_status TO tenant_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts, public.installments TO tenant_runtime;
