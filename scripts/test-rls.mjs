import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

// Only against an ISOLATED test DB. Keep privileged credentials out of CI logs.
const url = process.env.TEST_DATABASE_URL_ADMIN;
if (!url) throw new Error("TEST_DATABASE_URL_ADMIN must target a disposable test database");
const db = postgres(url, { max: 1, prepare: false });
const a = randomUUID(), b = randomUUID(), marker = randomUUID().slice(0,8);
const rollback = new Error("INTENTIONAL_TEST_ROLLBACK");
let passed = false;

async function checkTenant(tx, tenantId, expectedEmail, forbiddenEmail, expectedSlug, forbiddenSlug) {
  await tx.unsafe("SET LOCAL ROLE tenant_runtime");
  await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
  const t = await tx`SELECT tenant_id, slug FROM public.tenants ORDER BY slug`;
  const u = await tx`SELECT tenant_id, email FROM public.users ORDER BY email`;
  assert.equal(t.length, 1, "RLS must expose one tenant only");
  assert.equal(u.length, 1, "RLS must expose one user only");
  assert.equal(t[0].slug, expectedSlug);
  assert.equal(u[0].email, expectedEmail);
  assert.ok(!t.some(row => row.slug===forbiddenSlug));
  assert.ok(!u.some(row => row.email===forbiddenEmail));
  assert.equal((await tx`SELECT count(*)::int AS n FROM public.users WHERE tenant_id = ${forbiddenSlug==="none"?tenantId:tenantId}::uuid`)[0].n, 1);
  await tx.unsafe("RESET ROLE");
}
try {
  try {
    await db.begin(async tx => {
      const emailA = `a-${marker}@example.invalid`, emailB = `b-${marker}@example.invalid`;
      const slugA = `test-a-${marker}`, slugB = `test-b-${marker}`;
      await tx`INSERT INTO public.tenants (tenant_id,name,slug) VALUES (${a},'Tenant A',${slugA}),(${b},'Tenant B',${slugB})`;
      await tx`INSERT INTO public.users (tenant_id,email,full_name,role) VALUES
        (${a},${emailA},'A Seller','SALES'),(${b},${emailB},'B Accountant','ACCOUNTANT')`;
      await tx.unsafe("SET LOCAL ROLE tenant_runtime");
      const noContext = await tx`SELECT count(*)::int AS n FROM public.users`;
      assert.equal(noContext[0].n, 0, "Fail-closed when tenant context is missing");
      await tx.unsafe("RESET ROLE");
      await checkTenant(tx,a,emailA,emailB,slugA,slugB);
      await checkTenant(tx,b,emailB,emailA,slugB,slugA);
      await tx.unsafe("SET LOCAL ROLE tenant_runtime");
      const rights = await tx`SELECT has_table_privilege(current_user,'public.users','INSERT') AS can_insert,
        has_table_privilege(current_user,'public.users','UPDATE') AS can_update`;
      assert.equal(rights[0].can_insert,false);
      assert.equal(rights[0].can_update,false);
      await tx.unsafe("RESET ROLE");
      passed = true;
      throw rollback; // all fixture writes roll back automatically
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.ok(passed);
  console.log("PASS: missing context -> zero rows; A cannot read B; B cannot read A; runtime cannot write; fixtures rolled back");
} finally {
  await db.end();
}
