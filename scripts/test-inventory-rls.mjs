import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

// Run ONLY on the CI disposable PostgreSQL DB (or isolated throwaway Neon branch).
const url = process.env.TEST_DATABASE_URL_ADMIN;
if (!url) throw new Error("TEST_DATABASE_URL_ADMIN required (must be a disposable DB)");
const db = postgres(url, { max: 1, prepare: false });
const a = randomUUID(), b = randomUUID(), marker = randomUUID().slice(0, 8);
const sentinel = new Error("INVENTORY_TEST_ROLLBACK");
let allAssertionsPassed = false;

async function assumeTenant(tx, id) {
  await tx.unsafe("SET LOCAL ROLE tenant_runtime");
  await tx`SELECT set_config('app.tenant_id', ${id}, true)`;
}
async function backToOwner(tx) {
  await tx.unsafe("RESET ROLE");
}
async function expectSqlFailure(tx, action, expectedCode) {
  // Savepoint keeps the enclosing transaction valid after an expected SQL error.
  await assert.rejects(
    tx.savepoint(async sp => action(sp)),
    (error) => error?.code === expectedCode,
    `Expected PostgreSQL error code ${expectedCode}`,
  );
}

try {
  try {
    await db.begin(async tx => {
      const pidA = randomUUID(), pidB = randomUUID();
      const phaseA = randomUUID(), phaseB = randomUUID();
      const buildingA = randomUUID(), buildingB = randomUUID();
      const unitA = randomUUID(), unitB = randomUUID();
      await tx`INSERT INTO public.tenants (tenant_id,name,slug) VALUES
        (${a},'A Company',${"inventory-a-"+marker}),(${b},'B Company',${"inventory-b-"+marker})`;
      await tx`INSERT INTO public.projects (id,tenant_id,name,location,status) VALUES
        (${pidA},${a},'A Project','Cairo','ACTIVE'),
        (${pidB},${b},'B Project','Giza','PLANNED')`;
      await tx`INSERT INTO public.phases (id,tenant_id,project_id,name) VALUES
        (${phaseA},${a},${pidA},'Phase A'),(${phaseB},${b},${pidB},'Phase B')`;
      await tx`INSERT INTO public.buildings (id,tenant_id,phase_id,name) VALUES
        (${buildingA},${a},${phaseA},'Building A'),(${buildingB},${b},${phaseB},'Building B')`;
      await tx`INSERT INTO public.units (id,tenant_id,building_id,unit_number,area,price,status,svg_coordinates) VALUES
        (${unitA},${a},${buildingA},'A-101','95.50','2500000.15','AVAILABLE','{"points":[[0,0],[1,1]]}'::jsonb),
        (${unitB},${b},${buildingB},'B-201','107.25','3250000.40','AVAILABLE',NULL)`;

      await assumeTenant(tx,a);
      const rowsA = await tx`SELECT id,tenant_id FROM public.projects`;
      const unitsA = await tx`SELECT unit_number, price::text AS price FROM public.units`;
      assert.equal(rowsA.length, 1);
      assert.equal(rowsA[0].id, pidA);
      assert.equal(unitsA.length, 1);
      assert.equal(unitsA[0].unit_number, "A-101");
      assert.equal(unitsA[0].price, "2500000.15");
      assert.equal((await tx`SELECT count(*)::int AS n FROM public.phases`)[0].n, 1);
      assert.equal((await tx`SELECT count(*)::int AS n FROM public.buildings`)[0].n, 1);
      assert.equal((await tx`SELECT count(*)::int AS n FROM public.units WHERE tenant_id=${b}`)[0].n,0);
      assert.equal((await tx`UPDATE public.projects SET name='Wrong' WHERE id=${pidB} RETURNING id`).length,0);
      assert.equal((await tx`UPDATE public.units SET status='SOLD' WHERE id=${unitB} RETURNING id`).length,0);
      assert.equal((await tx`DELETE FROM public.units WHERE id=${unitB} RETURNING id`).length,0);
      assert.equal((await tx`DELETE FROM public.projects WHERE id=${pidB} RETURNING id`).length,0);

      // Tenant A can perform permitted writes on its own data.
      const added = await tx`INSERT INTO public.units (tenant_id,building_id,unit_number,area,price)
        VALUES (${a},${buildingA},'A-102','80.00','1800000.01') RETURNING status, price::text AS price`;
      assert.equal(added[0].status,"AVAILABLE");
      assert.equal(added[0].price,"1800000.01");
      assert.equal((await tx`UPDATE public.units SET status='BOOKED' WHERE tenant_id=${a}
        AND unit_number='A-102' RETURNING status`)[0].status,"BOOKED");
      assert.equal((await tx`DELETE FROM public.units WHERE tenant_id=${a}
        AND unit_number='A-102' RETURNING id`).length,1);

      // Missing tenant_id must always fail; tenant A must not insert B's data.
      await expectSqlFailure(tx, sp => sp`INSERT INTO public.units (building_id,unit_number,area,price)
        VALUES (${buildingA},'INVALID-NO-TENANT','20.00','1.00')`, "42501");
      await expectSqlFailure(tx, sp => sp`INSERT INTO public.units (tenant_id,building_id,unit_number,area,price)
        VALUES (${b},${buildingB},'INVALID-B','20.00','1.00')`, "42501");
      // Even knowing B's parent UUID does not let A link its own records to B.
      await expectSqlFailure(tx, sp => sp`INSERT INTO public.units (tenant_id,building_id,unit_number,area,price)
        VALUES (${a},${buildingB},'INVALID-CROSS-BUILDING','20.00','1.00')`, "23503");
      await expectSqlFailure(tx, sp => sp`INSERT INTO public.phases (tenant_id,project_id,name)
        VALUES (${a},${pidB},'INVALID-CROSS-PROJECT')`, "23503");
      await expectSqlFailure(tx, sp => sp`INSERT INTO public.buildings (tenant_id,phase_id,name)
        VALUES (${a},${phaseB},'INVALID-CROSS-PHASE')`, "23503");

      await backToOwner(tx);
      // The runtime rejects a missing tenant via RLS first (42501).
      // Check the NOT NULL constraint independently as migration owner (23502).
      await expectSqlFailure(tx, sp => sp`INSERT INTO public.units (building_id,unit_number,area,price)
        VALUES (${buildingA},'INVALID-NULL-TENANT-AS-OWNER','20.00','1.00')`, "23502");
      await assumeTenant(tx,b);
      const rowsB = await tx`SELECT id FROM public.projects`;
      const unitsB = await tx`SELECT id FROM public.units`;
      assert.equal(rowsB.length,1);
      assert.equal(rowsB[0].id,pidB);
      assert.equal(unitsB.length,1);
      assert.equal(unitsB[0].id,unitB);
      assert.equal((await tx`SELECT count(*)::int AS n FROM public.projects WHERE tenant_id=${a}`)[0].n,0);
      assert.equal((await tx`SELECT count(*)::int AS n FROM public.units WHERE tenant_id=${a}`)[0].n,0);

      await backToOwner(tx);
      await tx.unsafe("SET LOCAL ROLE tenant_runtime");
      // A missing tenant context in a NEW transaction is checked separately below;
      // RESET app.tenant_id explicitly here since the variable is transaction-local.
      await tx`SELECT set_config('app.tenant_id','',true)`;
      assert.equal((await tx`SELECT count(*)::int AS n FROM public.projects`)[0].n,0);
      assert.equal((await tx`SELECT count(*)::int AS n FROM public.units`)[0].n,0);
      await backToOwner(tx);

      allAssertionsPassed = true;
      throw sentinel; // never persist fixtures
    });
  } catch(error) {
    if(error !== sentinel) throw error;
  }
  assert.equal(allAssertionsPassed,true);
  console.log("PASS: inventory RLS A/B, CRUD, no tenant_id, cross-tenant parents, exact numeric, rollback");
} finally {
  await db.end();
}
