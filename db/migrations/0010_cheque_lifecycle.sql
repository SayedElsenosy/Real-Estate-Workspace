DO $$ BEGIN CREATE TYPE public.cheque_clearance_status_enum AS ENUM ('PENDING','CLEARED','BOUNCED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS bounced_reason text;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS bounced_at timestamptz;
UPDATE public.receipts SET cheque_clearance_status='CLEARED' WHERE method <> 'CHEQUE' AND cheque_clearance_status IS DISTINCT FROM 'CLEARED';
-- Leave historical cheque NULL statuses unclassified; never infer bank collection state.
ALTER TABLE public.receipts ALTER COLUMN cheque_clearance_status TYPE public.cheque_clearance_status_enum USING cheque_clearance_status::public.cheque_clearance_status_enum;
-- Default is CLEARED for ordinary receipts; a trigger overrides CHEQUE to PENDING.
ALTER TABLE public.receipts ALTER COLUMN cheque_clearance_status SET DEFAULT 'CLEARED'::public.cheque_clearance_status_enum;
CREATE OR REPLACE FUNCTION public.receipt_initial_clearance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.method='CHEQUE' THEN NEW.cheque_clearance_status:='PENDING'; ELSE NEW.cheque_clearance_status:='CLEARED'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS receipt_initial_clearance_trigger ON public.receipts;
CREATE TRIGGER receipt_initial_clearance_trigger BEFORE INSERT ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.receipt_initial_clearance();
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='receipt_clearance_method_check') THEN
 ALTER TABLE public.receipts ADD CONSTRAINT receipt_clearance_method_check CHECK(method='CHEQUE' OR cheque_clearance_status='CLEARED');
END IF; END $$;
-- A bounced receipt is retained for audit but must not block a replacement payment.
DROP INDEX IF EXISTS public.receipts_single_settlement_per_installment_idx;
-- Only for databases that have not reached the event-based append-only stage.
-- On replay after stage 11, an old PENDING receipt can have a BOUNCED event
-- and a valid replacement receipt. The legacy index would wrongly reject it.
DO $legacy_index_guard$ BEGIN
 IF to_regclass('public.receipt_cheque_events') IS NULL THEN
  CREATE UNIQUE INDEX IF NOT EXISTS receipts_single_settlement_per_installment_idx
    ON public.receipts(tenant_id,installment_id)
    WHERE installment_id IS NOT NULL AND cheque_clearance_status IS DISTINCT FROM 'BOUNCED';
 END IF;
END $legacy_index_guard$;
CREATE INDEX IF NOT EXISTS receipts_cheque_queue_idx ON public.receipts(tenant_id,cheque_clearance_status,created_at) WHERE method='CHEQUE';
GRANT USAGE ON TYPE public.cheque_clearance_status_enum TO tenant_runtime;

DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='receipt_bounce_audit_check') THEN
 ALTER TABLE public.receipts ADD CONSTRAINT receipt_bounce_audit_check
 CHECK (cheque_clearance_status IS DISTINCT FROM 'BOUNCED' OR (method='CHEQUE' AND bounced_reason IS NOT NULL AND length(btrim(bounced_reason))>0 AND bounced_at IS NOT NULL));
END IF; END $$;
