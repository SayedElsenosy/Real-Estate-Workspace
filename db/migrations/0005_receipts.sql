-- 0005_receipts.sql — Treasury receipts, stage 5 only.
-- Run as the trusted migration owner, never as the web runtime.
-- The tenant+contract+installment composite reference guards same-company,
-- same-contract ownership, not merely same-tenant membership.

CREATE TYPE public.payment_method AS ENUM ('CASH','BANK_TRANSFER','CHEQUE');

-- A composite FK must reference a UNIQUE/PRIMARY KEY column combination.
ALTER TABLE public.installments
  ADD CONSTRAINT installments_tenant_contract_id_unique
  UNIQUE (tenant_id, contract_id, id);

CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE RESTRICT,
  contract_id uuid NOT NULL,
  installment_id uuid,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL,
  reference_number text,
  receipt_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipts_tenant_contract_fk
    FOREIGN KEY (tenant_id, contract_id)
    REFERENCES public.contracts (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT receipts_tenant_contract_installment_fk
    FOREIGN KEY (tenant_id, contract_id, installment_id)
    REFERENCES public.installments (tenant_id, contract_id, id) ON DELETE RESTRICT,
  CONSTRAINT receipts_reference_required_check
    CHECK (method = 'CASH' OR length(btrim(reference_number)) > 0)
);

CREATE INDEX receipts_tenant_contract_date_idx
  ON public.receipts (tenant_id, contract_id, receipt_date);
CREATE INDEX receipts_tenant_installment_idx
  ON public.receipts (tenant_id, installment_id);

-- Stage 5 supports full installment settlement only, not partial reversals.
CREATE UNIQUE INDEX receipts_single_settlement_per_installment_idx
  ON public.receipts (tenant_id, installment_id)
  WHERE installment_id IS NOT NULL;

-- Avoid duplicate non-cash instrument references within the same tenant/method.
CREATE UNIQUE INDEX receipts_tenant_method_reference_unique
  ON public.receipts (tenant_id, method, reference_number)
  WHERE method <> 'CASH' AND reference_number IS NOT NULL;

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_runtime_receipt_crud ON public.receipts
  FOR ALL TO tenant_runtime
  USING (tenant_id = (SELECT app.current_tenant_id()))
  WITH CHECK (tenant_id = (SELECT app.current_tenant_id()));

DO $$
DECLARE migration_principal text := current_user;
BEGIN
  EXECUTE format(
    'CREATE POLICY migrations_admin ON public.receipts
       FOR ALL TO %I USING (true) WITH CHECK (true)', migration_principal);
END $$;

GRANT USAGE ON TYPE public.payment_method TO tenant_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO tenant_runtime;
