-- Stage 3: Atomic Booking Engine (no contracts or installments).
-- Deploy using the SAME trusted database migration role as 0001 and 0002.
DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'PENDING',
  customer_name text NOT NULL CHECK (length(btrim(customer_name)) BETWEEN 1 AND 200),
  customer_phone text NOT NULL CHECK (length(btrim(customer_phone)) BETWEEN 6 AND 30),
  booking_date timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  CONSTRAINT bookings_unit_tenant_fk FOREIGN KEY (tenant_id, unit_id)
    REFERENCES public.units (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT bookings_expires_after_creation_check
    CHECK (expires_at IS NULL OR expires_at > booking_date)
);

CREATE INDEX IF NOT EXISTS bookings_tenant_unit_status_idx
  ON public.bookings (tenant_id, unit_id, status);

-- Last line of defence if other writers bypass the booking service.
-- Pending and confirmed bookings are active; cancelled bookings do not occupy the slot.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_active_per_unit_idx
  ON public.bookings (tenant_id, unit_id)
  WHERE status IN ('PENDING', 'CONFIRMED');

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='bookings'
      AND policyname='tenant_runtime_booking_crud'
  ) THEN
    CREATE POLICY tenant_runtime_booking_crud ON public.bookings
      FOR ALL TO tenant_runtime
      USING (tenant_id = (SELECT app.current_tenant_id()))
      WITH CHECK (tenant_id = (SELECT app.current_tenant_id()));
  END IF;
END $$;

DO $$
DECLARE migration_principal text := current_user;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='bookings'
      AND policyname='migrations_admin'
  ) THEN
    EXECUTE format(
      'CREATE POLICY migrations_admin ON public.bookings
       FOR ALL TO %I USING (true) WITH CHECK (true)',
      migration_principal
    );
  END IF;
END $$;

GRANT USAGE ON TYPE public.booking_status TO tenant_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO tenant_runtime;
