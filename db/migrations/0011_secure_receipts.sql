-- 0011: immutable receipts and append-only cheque lifecycle events.
-- Existing cheque processing history stays in receipts as the original snapshot.
DO $secure$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='receipts_tenant_id_id_unique') THEN
  ALTER TABLE public.receipts ADD CONSTRAINT receipts_tenant_id_id_unique UNIQUE(tenant_id,id);
 END IF;
END $secure$;
CREATE TABLE IF NOT EXISTS public.receipt_cheque_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 receipt_id uuid NOT NULL,
 new_status public.cheque_clearance_status_enum NOT NULL CHECK(new_status IN ('CLEARED','BOUNCED')),
 reason text,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT receipt_cheque_events_scope_fk FOREIGN KEY(tenant_id,receipt_id) REFERENCES public.receipts(tenant_id,id) ON DELETE RESTRICT,
 CONSTRAINT receipt_cheque_events_reason_check CHECK (new_status <> 'BOUNCED' OR (reason IS NOT NULL AND length(btrim(reason)) BETWEEN 1 AND 1000)),
 CONSTRAINT receipt_cheque_one_resolution UNIQUE(tenant_id,receipt_id)
);
-- Before creating this table, ensure the referenced composite key exists.

CREATE INDEX IF NOT EXISTS receipt_cheque_events_tenant_idx ON public.receipt_cheque_events(tenant_id,recorded_at);
ALTER TABLE public.receipt_cheque_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_cheque_events FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='receipt_cheque_events' AND policyname='tenant_cheque_event_read_insert') THEN
  CREATE POLICY tenant_cheque_event_read_insert ON public.receipt_cheque_events FOR ALL TO tenant_runtime
   USING(tenant_id=(SELECT app.current_tenant_id())) WITH CHECK(tenant_id=(SELECT app.current_tenant_id()));
 END IF;
END $$;
DO $$ DECLARE owner_role text:=current_user; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='receipt_cheque_events' AND policyname='migrations_admin') THEN
  EXECUTE format('CREATE POLICY migrations_admin ON public.receipt_cheque_events FOR ALL TO %I USING(true) WITH CHECK(true)',owner_role);
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.prevent_immutable_financial_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Financial record is append-only; post a compensating entry instead' USING ERRCODE='P0001';
END $$;
DROP TRIGGER IF EXISTS receipts_immutable_guard ON public.receipts;
CREATE TRIGGER receipts_immutable_guard BEFORE UPDATE OR DELETE ON public.receipts
 FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_financial_changes();
DROP TRIGGER IF EXISTS receipt_cheque_events_immutable_guard ON public.receipt_cheque_events;
CREATE TRIGGER receipt_cheque_events_immutable_guard BEFORE UPDATE OR DELETE ON public.receipt_cheque_events
 FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_financial_changes();
REVOKE UPDATE,DELETE ON public.receipts FROM tenant_runtime;
GRANT SELECT,INSERT ON public.receipts TO tenant_runtime;
REVOKE UPDATE,DELETE ON public.receipt_cheque_events FROM tenant_runtime;
GRANT SELECT,INSERT ON public.receipt_cheque_events TO tenant_runtime;

-- Active receipts require event-aware uniqueness; a bounced receipt may be replaced.
DROP INDEX IF EXISTS public.receipts_single_settlement_per_installment_idx;
CREATE OR REPLACE FUNCTION public.prevent_duplicate_active_installment_receipt() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.installment_id IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':'||NEW.installment_id::text,0));
  IF EXISTS (
   SELECT 1 FROM public.receipts r
   LEFT JOIN public.receipt_cheque_events e ON e.tenant_id=r.tenant_id AND e.receipt_id=r.id
   WHERE r.tenant_id=NEW.tenant_id AND r.installment_id=NEW.installment_id
     AND COALESCE(e.new_status,r.cheque_clearance_status) IS DISTINCT FROM 'BOUNCED'::public.cheque_clearance_status_enum
  ) THEN
   RAISE EXCEPTION 'Installment already has a non-bounced receipt'
    USING ERRCODE='23505', CONSTRAINT='receipts_active_installment_guard';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS receipts_active_installment_guard ON public.receipts;
CREATE TRIGGER receipts_active_installment_guard BEFORE INSERT ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_active_installment_receipt();
