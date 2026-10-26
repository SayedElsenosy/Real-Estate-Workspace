import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../lib/db/schema.ts";
import { createSignedContract, ContractError } from "../lib/contracts/create-contract.ts";
import { PaymentPlanError } from "../lib/contracts/generate-installments.ts";

const url = process.env.TEST_DATABASE_URL_ADMIN;
if (!url) throw new Error("A disposable TEST_DATABASE_URL_ADMIN is required");
const owner = postgres(url, { prepare:false, max:3 });
const tag = randomUUID().replaceAll("-","").slice(0,14);
const username = "contract_test_" + tag;
const password = randomBytes(28).toString("hex");
const tenantA=randomUUID(), tenantB=randomUUID();
const project=randomUUID(), phase=randomUUID(), building=randomUUID();
const unitA=randomUUID(),unitTiny=randomUUID();
const bookingA=randomUUID(),bookingTiny=randomUUID();
const subject="contract-admin-"+tag;
let runtime, roleCreated=false, fixturesCreated=false;

try {
  // This is a database INTEGRATION test on a disposable CI PostgreSQL service.
  await owner.unsafe(`CREATE ROLE ${username} LOGIN PASSWORD '${password}' NOBYPASSRLS`);
  roleCreated=true;
  await owner.unsafe(`GRANT tenant_runtime TO ${username}`);
  const runtimeUrl=new URL(url);
  runtimeUrl.username=username; runtimeUrl.password=password;
  runtime=postgres(runtimeUrl.toString(),{prepare:false,max:6});
  const db=drizzle(runtime,{schema});

  await owner`INSERT INTO public.tenants(tenant_id,name,slug) VALUES
    (${tenantA},'Contract A',${"contract-a-"+tag}),
    (${tenantB},'Contract B',${"contract-b-"+tag})`;
  fixturesCreated=true;
  await owner`INSERT INTO public.users(tenant_id,email,full_name,role,external_auth_id)
    VALUES(${tenantA},${"admin-"+tag+"@example.invalid"},'Admin','COMPANY_ADMIN',${subject})`;
  await owner`INSERT INTO public.projects(id,tenant_id,name) VALUES(${project},${tenantA},'Project')`;
  await owner`INSERT INTO public.phases(id,tenant_id,project_id,name)
    VALUES(${phase},${tenantA},${project},'Phase')`;
  await owner`INSERT INTO public.buildings(id,tenant_id,phase_id,name)
    VALUES(${building},${tenantA},${phase},'Building')`;
  await owner`INSERT INTO public.units(id,tenant_id,building_id,unit_number,area,price,status)
    VALUES(${unitA},${tenantA},${building},'101','95.50','1000000.01','BOOKED'),
          (${unitTiny},${tenantA},${building},'102','45.00','0.02','BOOKED')`;
  await owner`INSERT INTO public.bookings(id,tenant_id,unit_id,status,customer_name,customer_phone)
    VALUES(${bookingA},${tenantA},${unitA},'CONFIRMED','Buyer','01000000000'),
          (${bookingTiny},${tenantA},${unitTiny},'CONFIRMED','Tiny Buyer','01000000001')`;

  const input={tenantId:tenantA,externalAuthId:subject,bookingId:bookingA,
    totalAmount:"1000000.01",paymentPlan:{downPaymentPercent:"0",installmentCount:3,intervalMonths:3}};
  // Two concurrent signatures: at most one contract for the same booking.
  const attempts=await Promise.all([0,1].map(async()=> {
    try { return {ok:true,result:await createSignedContract(db,input)}; }
    catch(error){ return {ok:false,error}; }
  }));
  const winners=attempts.filter(x=>x.ok), failures=attempts.filter(x=>!x.ok);
  assert.equal(winners.length,1);
  assert.equal(failures.length,1);
  assert.ok(failures[0].error instanceof ContractError);
  assert.equal(failures[0].error.code,"CONTRACT_EXISTS");

  const result=winners[0].result;
  assert.equal(result.contract.status,"ACTIVE");
  assert.equal(result.contract.totalAmount,"1000000.01");
  assert.equal(result.contract.unitPriceSnapshot,"1000000.01");
  assert.equal(result.installments.length,3);
  const amounts=result.installments.sort((x,y)=>x.sequence-y.sequence).map(x=>x.amount);
  assert.deepEqual(amounts,["333333.34","333333.34","333333.33"]);
  assert.equal(amounts.reduce((a,b)=>a.plus(new Decimal(b)),new Decimal("0")).toFixed(2),"1000000.01");
  const saved=await owner`SELECT count(*)::int AS n FROM public.contracts
    WHERE tenant_id=${tenantA} AND booking_id=${bookingA}`;
  assert.equal(saved[0].n,1);
  const sold=await owner`SELECT status FROM public.units WHERE id=${unitA}`;
  assert.equal(sold[0].status,"SOLD","Signed contract must atomically mark unit SOLD");
  const totals=await owner`SELECT count(*)::int AS n,sum(amount)::text AS amount
    FROM public.installments WHERE tenant_id=${tenantA} AND contract_id=${result.contract.id}`;
  assert.equal(totals[0].n,3);
  assert.equal(totals[0].amount,"1000000.01");

  // Price spoofing is forbidden, as is changing the tenant identity without membership.
  await assert.rejects(
    createSignedContract(db,{...input,tenantId:tenantB}),
    err=>err instanceof ContractError && err.code==="UNAUTHORIZED");
  await assert.rejects(
    createSignedContract(db,{...input,bookingId:bookingTiny,totalAmount:"0.03"}),
    err=>err instanceof ContractError && err.code==="PRICE_MISMATCH");

  // Integration rollback AFTER INSERTING the contract: tiny amount cannot be
  // split into three strictly positive installments. No orphan contract remains.
  await assert.rejects(
    createSignedContract(db,{...input,bookingId:bookingTiny,totalAmount:"0.02"}),
    err=>err instanceof PaymentPlanError);
  const noOrphan=await owner`SELECT count(*)::int AS n FROM public.contracts
    WHERE tenant_id=${tenantA} AND booking_id=${bookingTiny}`;
  assert.equal(noOrphan[0].n,0,"Failed installment schedule must roll back inserted contract");
  console.log("PASS stage4: exact 1000000.01; 3 payments; single contract under concurrency; price/tenant checks; rollback");
} finally {
  if(runtime) await runtime.end();
  if(fixturesCreated) {
    await owner`DELETE FROM public.installments WHERE tenant_id=${tenantA}`;
    await owner`DELETE FROM public.contracts WHERE tenant_id=${tenantA}`;
    await owner`DELETE FROM public.bookings WHERE tenant_id=${tenantA}`;
    await owner`DELETE FROM public.units WHERE tenant_id=${tenantA}`;
    await owner`DELETE FROM public.buildings WHERE tenant_id=${tenantA}`;
    await owner`DELETE FROM public.phases WHERE tenant_id=${tenantA}`;
    await owner`DELETE FROM public.projects WHERE tenant_id=${tenantA}`;
    await owner`DELETE FROM public.users WHERE tenant_id=${tenantA}`;
    await owner`DELETE FROM public.tenants WHERE tenant_id IN (${tenantA},${tenantB})`;
  }
  if(roleCreated) await owner.unsafe(`DROP ROLE ${username}`);
  await owner.end();
}
