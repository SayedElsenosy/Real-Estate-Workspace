-- Newly recorded cheques start pending clearance; historical unclassified receipts stay NULL.
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS cheque_clearance_status text;
CREATE INDEX IF NOT EXISTS receipts_tenant_cheque_status_idx ON public.receipts(tenant_id,cheque_clearance_status);
