-- 0002_inventory.sql — Stage 2 ONLY; NO booking / contract / installment objects.
-- Tenant-scoped parentage is enforced with composite FKs, not only application filters.
-- Run as the same dedicated migration owner that owns 0001 tables.
DO $$ BEGIN
  CREATE TYPE public.project_status AS ENUM ('PLANNED','ACTIVE','ON_HOLD','COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.unit_status AS ENUM ('AVAILABLE','BOOKED','SOLD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  location text NOT NULL DEFAULT '',
  status public.project_status NOT NULL DEFAULT 'PLANNED',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_tenant_id_id_key UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE RESTRICT,
  project_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phases_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT phases_project_tenant_fk FOREIGN KEY (tenant_id, project_id)
    REFERENCES public.projects(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT phases_project_name_key UNIQUE (tenant_id, project_id, name)
);

CREATE TABLE IF NOT EXISTS public.buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE RESTRICT,
  phase_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buildings_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT buildings_phase_tenant_fk FOREIGN KEY (tenant_id, phase_id)
    REFERENCES public.phases(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT buildings_phase_name_key UNIQUE (tenant_id, phase_id, name)
);

CREATE TABLE IF NOT EXISTS public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE RESTRICT,
  building_id uuid NOT NULL,
  unit_number text NOT NULL CHECK (length(btrim(unit_number)) > 0),
  area numeric(12,2) NOT NULL CHECK (area > 0),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  status public.unit_status NOT NULL DEFAULT 'AVAILABLE',
  svg_coordinates jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT units_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT units_building_tenant_fk FOREIGN KEY (tenant_id, building_id)
    REFERENCES public.buildings(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT units_building_number_key UNIQUE (tenant_id, building_id, unit_number),
  CONSTRAINT units_svg_coordinates_object_check CHECK (
    svg_coordinates IS NULL OR jsonb_typeof(svg_coordinates) = 'object'
  )
);

-- Tenant-led lookup indexes. Composite foreign keys and unique constraints
-- prevent cross-company references even when a foreign UUID is known.
CREATE INDEX IF NOT EXISTS projects_tenant_status_idx ON public.projects (tenant_id, status);
CREATE INDEX IF NOT EXISTS phases_tenant_project_idx ON public.phases (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS buildings_tenant_phase_idx ON public.buildings (tenant_id, phase_id);
CREATE INDEX IF NOT EXISTS units_tenant_building_status_idx
  ON public.units (tenant_id, building_id, status);

-- Defence-in-depth: RLS for every operation, including INSERT and UPDATE.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units FORCE ROW LEVEL SECURITY;

DO $$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['projects','phases','buildings','units'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=relation_name
        AND policyname='tenant_runtime_inventory_crud'
    ) THEN
      EXECUTE format(
        'CREATE POLICY tenant_runtime_inventory_crud ON public.%I FOR ALL TO tenant_runtime
         USING (tenant_id = (SELECT app.current_tenant_id()))
         WITH CHECK (tenant_id = (SELECT app.current_tenant_id()))',
        relation_name
      );
    END IF;
  END LOOP;
END $$;

-- Allow migrations by the schema owner under FORCE RLS, but never share these
-- credentials with a web runtime or a user-facing API.
DO $$
DECLARE relation_name text;
DECLARE migration_principal text := current_user;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['projects','phases','buildings','units'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=relation_name
        AND policyname='migrations_admin'
    ) THEN
      EXECUTE format(
        'CREATE POLICY migrations_admin ON public.%I FOR ALL TO %I
         USING (true) WITH CHECK (true)',
        relation_name, migration_principal
      );
    END IF;
  END LOOP;
END $$;

GRANT USAGE ON TYPE public.project_status, public.unit_status TO tenant_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.projects, public.phases, public.buildings, public.units
  TO tenant_runtime;
