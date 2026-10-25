import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../lib/db/schema.ts";
import { BookingError, createConfirmedBooking } from "../lib/bookings/create-booking.ts";

const url = process.env.TEST_DATABASE_URL_ADMIN;
if (!url) throw new Error("TEST_DATABASE_URL_ADMIN must reference disposable PostgreSQL");
const admin = postgres(url, { prepare: false, max: 3 });
const token = randomUUID().replaceAll("-","").slice(0,14);
const role = "booking_test_" + token;
const secret = randomBytes(28).toString("hex");
const a = randomUUID(), b = randomUUID();
const projectA=randomUUID(), phaseA=randomUUID(), buildingA=randomUUID(), unitA=randomUUID();
const subject = "booking-test-" + token;
let appClient;
let adminRoleCreated=false, fixturesCreated=false;

async function expectCode(action, code) {
  await assert.rejects(action, error => error instanceof BookingError && error.code===code);
}
try {
  // Disposable CI database ONLY: use a real, restricted login to test RLS.
  await admin.unsafe(`CREATE ROLE ${role} LOGIN PASSWORD '${secret}' NOBYPASSRLS`);
  adminRoleCreated=true;
  await admin.unsafe(`GRANT tenant_runtime TO ${role}`);
  const aURL=new URL(url);
  aURL.username=role; aURL.password=secret;
  appClient=postgres(aURL.toString(), { prepare:false, max:15, connect_timeout:10 });
  const db=drizzle(appClient, { schema });

  await admin`INSERT INTO public.tenants (tenant_id,name,slug) VALUES
    (${a}, 'Booking A', ${"booking-a-"+token}), (${b}, 'Booking B', ${"booking-b-"+token})`;
  fixturesCreated=true;
  await admin`INSERT INTO public.users (tenant_id,email,full_name,role,external_auth_id)
    VALUES (${a},${"booking-"+token+"@example.invalid"},'Booking Sales','SALES',${subject})`;
  await admin`INSERT INTO public.projects(id,tenant_id,name,location,status)
    VALUES(${projectA},${a},'Booking Project','Cairo','ACTIVE')`;
  await admin`INSERT INTO public.phases(id,tenant_id,project_id,name)
    VALUES(${phaseA},${a},${projectA},'Phase 1')`;
  await admin`INSERT INTO public.buildings(id,tenant_id,phase_id,name)
    VALUES(${buildingA},${a},${phaseA},'Building 1')`;
  await admin`INSERT INTO public.units(id,tenant_id,building_id,unit_number,area,price)
    VALUES(${unitA},${a},${buildingA},'101','98.50','3500000.25')`;

  const input={tenantId:a,externalAuthId:subject,unitId:unitA,
    newCustomer:{fullName:"Concurrency Test Buyer",phonePrimary:"01000000000"}};
  // Explicitly exercise the SAME TypeScript service imported by the API route.
  const outcomes = await Promise.all(Array.from({length:10}, async(_,i)=>{
    try { return {ok:true,index:i,result:await createConfirmedBooking(db,input)}; }
    catch(error) { return {ok:false,index:i,error}; }
  }));
  const winners=outcomes.filter(o=>o.ok);
  const losers=outcomes.filter(o=>!o.ok);
  assert.equal(winners.length,1,"Exactly one booking must succeed");
  assert.equal(losers.length,9,"Nine competing requests must be rejected");
  assert.equal(winners[0].result.booking.status,"CONFIRMED");
  assert.equal(winners[0].result.unitStatus,"BOOKED");
  for (const failed of losers) {
    assert.ok(failed.error instanceof BookingError);
    assert.equal(failed.error.code,"UNIT_UNAVAILABLE");
    assert.equal(failed.error.httpStatus,409);
    assert.equal(failed.error.message,"الوحدة محجوزة بالفعل");
  }
  const unitRows=await admin`SELECT status,price::text AS price FROM public.units WHERE id=${unitA}`;
  assert.equal(unitRows[0].status,"BOOKED");
  assert.equal(unitRows[0].price,"3500000.25");
  const saved=await admin`SELECT id,status,tenant_id,unit_id FROM public.bookings WHERE tenant_id=${a} AND unit_id=${unitA}`;
  assert.equal(saved.length,1,"Exactly one booking row must be committed");
  assert.equal(saved[0].status,"CONFIRMED");
  assert.equal(saved[0].id,winners[0].result.booking.id);

  // A signed token for another tenant is useless without an actual matching user membership.
  await expectCode(createConfirmedBooking(db,{...input,tenantId:b}),"UNAUTHORIZED");
  console.log("PASS: Promise.all(10) -> 1 CONFIRMED + 9 conflicts; 1 booking row; BOOKED unit; cross-tenant identity denied");
} finally {
  if(appClient) await appClient.end();
  if(fixturesCreated){
    // Only remove known test fixture rows from this disposable database.
    await admin`DELETE FROM public.bookings WHERE tenant_id=${a}`;
    await admin`DELETE FROM public.customers WHERE tenant_id=${a}`;
    await admin`DELETE FROM public.units WHERE tenant_id=${a}`;
    await admin`DELETE FROM public.buildings WHERE tenant_id=${a}`;
    await admin`DELETE FROM public.phases WHERE tenant_id=${a}`;
    await admin`DELETE FROM public.projects WHERE tenant_id=${a}`;
    await admin`DELETE FROM public.users WHERE tenant_id=${a}`;
    await admin`DELETE FROM public.tenants WHERE tenant_id IN (${a},${b})`;
  }
  if(adminRoleCreated) await admin.unsafe(`DROP ROLE ${role}`);
  await admin.end();
}
