import assert from "node:assert/strict";
import postgres from "postgres";
const url=process.env.TEST_DATABASE_URL_ADMIN;
if(!url||!new URL(url).pathname.endsWith("/foundation_test"))throw Error("Requires disposable foundation_test PostgreSQL");
const db=postgres(url,{prepare:false,max:1});
try{
 const [permissions]=await db`SELECT
 has_table_privilege('tenant_runtime','public.receipts','SELECT') AS can_read,
 has_table_privilege('tenant_runtime','public.receipts','INSERT') AS can_insert,
 has_table_privilege('tenant_runtime','public.receipts','UPDATE') AS can_update,
 has_table_privilege('tenant_runtime','public.receipts','DELETE') AS can_delete,
 has_table_privilege('tenant_runtime','public.receipt_cheque_events','INSERT') AS events_insert,
 has_table_privilege('tenant_runtime','public.receipt_cheque_events','UPDATE') AS events_update`;
 assert.equal(permissions.can_read,true);
 assert.equal(permissions.can_insert,true);
 assert.equal(permissions.can_update,false);
 assert.equal(permissions.can_delete,false);
 assert.equal(permissions.events_insert,true);
 assert.equal(permissions.events_update,false);
 const triggers=await db`SELECT tgname FROM pg_trigger
 WHERE tgrelid IN ('public.receipts'::regclass,'public.receipt_cheque_events'::regclass)
 AND NOT tgisinternal AND tgenabled <> 'D'`;
 for(const required of ["receipts_immutable_guard","receipt_cheque_events_immutable_guard","receipts_active_installment_guard"]){
  assert.ok(triggers.some(t=>t.tgname===required),required+" guard missing");
 }
 await db.begin(async tx=>{
  await tx.unsafe("SET LOCAL ROLE tenant_runtime");
  await assert.rejects(tx.savepoint(sp=>sp.unsafe("UPDATE public.receipts SET reference_number='x' WHERE false")),e=>e.code==="42501");
  await assert.rejects(tx.savepoint(sp=>sp.unsafe("DELETE FROM public.receipts WHERE false")),e=>e.code==="42501");
 });
 console.log("PASS: runtime receipts SELECT/INSERT only, append-only guards active, unauthorized UPDATE/DELETE rejected");
}finally{await db.end();}
