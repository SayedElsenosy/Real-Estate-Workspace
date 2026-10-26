import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../lib/db/schema.ts";
import { recordPayment, PaymentError } from "../lib/finance/record-payment.ts";

const connection=process.env.TEST_DATABASE_URL_ADMIN;
if(!connection) throw new Error("Use a disposable TEST_DATABASE_URL_ADMIN only");
const owner=postgres(connection,{prepare:false,max:3});
const tag=randomUUID().replaceAll("-","").slice(0,14);
const role="receipt_test_"+tag, password=randomBytes(28).toString("hex");
const a=randomUUID(),b=randomUUID(),project=randomUUID(),phase=randomUUID();
const building=randomUUID(),unit=randomUUID(),booking=randomUUID(),contract=randomUUID();
const installment1=randomUUID(),installment2=randomUUID(),installment3=randomUUID();
const subject="finance-accountant-"+tag;
let runtime,roleCreated=false,fixturesCreated=false;
async function expectPaymentCode(task,code,message) {
  await assert.rejects(task,err=>err instanceof PaymentError &&
    err.code===code && (message===undefined || err.message===message));
}
try {
  await owner.unsafe(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOBYPASSRLS`);
  roleCreated=true;
  await owner.unsafe(`GRANT tenant_runtime TO ${role}`);
  const url=new URL(connection);
  url.username=role;url.password=password;
  runtime=postgres(url.toString(),{prepare:false,max:10,connect_timeout:10});
  const db=drizzle(runtime,{schema});

  await owner`INSERT INTO public.tenants(tenant_id,name,slug) VALUES
    (${a},'Receipt A',${"receipt-a-"+tag}),(${b},'Receipt B',${"receipt-b-"+tag})`;
  fixturesCreated=true;
  await owner`INSERT INTO public.users(tenant_id,email,full_name,role,external_auth_id) VALUES
    (${a},${"accountant-"+tag+"@example.invalid"},'Accountant','ACCOUNTANT',${subject}),
    (${a},${"sales-"+tag+"@example.invalid"},'Sales','SALES',${subject+"-sales"})`;
  await owner`INSERT INTO public.projects(id,tenant_id,name) VALUES(${project},${a},'Project')`;
  await owner`INSERT INTO public.phases(id,tenant_id,project_id,name)
    VALUES(${phase},${a},${project},'Phase')`;
  await owner`INSERT INTO public.buildings(id,tenant_id,phase_id,name)
    VALUES(${building},${a},${phase},'Building')`;
  await owner`INSERT INTO public.units(id,tenant_id,building_id,unit_number,area,price,status)
    VALUES(${unit},${a},${building},'101','100.00','1000000.01','BOOKED')`;
  await owner`INSERT INTO public.bookings(id,tenant_id,unit_id,status,customer_name,customer_phone)
    VALUES(${booking},${a},${unit},'CONFIRMED','Buyer','01000000000')`;
  await owner`INSERT INTO public.contracts(id,tenant_id,booking_id,total_amount,unit_price_snapshot,payment_plan_snapshot,status,signed_at)
    VALUES(${contract},${a},${booking},'1000000.01','1000000.01',
      '{"downPaymentPercent":"0","installmentCount":3,"intervalMonths":3}'::jsonb,'ACTIVE',now())`;
  await owner`INSERT INTO public.installments(id,tenant_id,contract_id,sequence,due_date,amount,status) VALUES
    (${installment1},${a},${contract},1,'2026-11-01','333333.34','PENDING'),
    (${installment2},${a},${contract},2,'2027-02-01','333333.34','OVERDUE'),
    (${installment3},${a},${contract},3,'2027-05-01','333333.33','PENDING')`;

  const payment={
    tenantId:a,externalAuthId:subject,contractId:contract,installmentId:installment1,
    amount:"333333.34",method:"CASH",referenceNumber:null,receiptDate:"2026-10-25",
  };
  const outcomes=await Promise.all(Array.from({length:5},async(_,i)=>{
    try{return {ok:true,index:i,value:await recordPayment(db,payment)};}
    catch(error){return {ok:false,index:i,error};}
  }));
  const winners=outcomes.filter(x=>x.ok),rejected=outcomes.filter(x=>!x.ok);
  assert.equal(winners.length,1,"Exactly one concurrent payment must succeed");
  assert.equal(rejected.length,4,"Four attempts must fail");
  assert.equal(winners[0].value.installmentStatus,"PAID");
  assert.equal(winners[0].value.receipt.amount,"333333.34");
  for(const entry of rejected){
    assert.ok(entry.error instanceof PaymentError);
    assert.equal(entry.error.code,"ALREADY_PAID");
    assert.equal(entry.error.message,"القسط مدفوع بالفعل");
    assert.equal(entry.error.httpStatus,409);
  }
  const paid=await owner`SELECT status FROM public.installments WHERE id=${installment1}`;
  assert.equal(paid[0].status,"PAID");
  const total=await owner`SELECT count(*)::int AS n,sum(amount)::text AS total
    FROM public.receipts WHERE tenant_id=${a} AND installment_id=${installment1}`;
  assert.equal(total[0].n,1);
  assert.equal(total[0].total,"333333.34");

  await expectPaymentCode(recordPayment(db,{...payment,installmentId:installment2,amount:"333333.33"}),"AMOUNT_MISMATCH");
  await expectPaymentCode(recordPayment(db,{...payment,installmentId:installment2,amount:"333333.35"}),"AMOUNT_MISMATCH");
  await expectPaymentCode(recordPayment(db,{...payment,tenantId:b}),"UNAUTHORIZED");
  await expectPaymentCode(recordPayment(db,{...payment,externalAuthId:subject+"-sales"}),"FORBIDDEN");

  // A unique bank-transfer reference failure must roll back PAID -> OVERDUE.
  const bankPayment={...payment,installmentId:installment2,method:"BANK_TRANSFER",
    referenceNumber:"BANK-REF-"+tag,amount:"333333.34"};
  const bankReceipt=await recordPayment(db,bankPayment);
  assert.equal(bankReceipt.installmentStatus,"PAID");
  await assert.rejects(
    recordPayment(db,{...bankPayment,installmentId:installment3,amount:"333333.33"}),
    error=>[error?.code,error?.cause?.code].includes("23505"),
  );
  const finalThird=await owner`SELECT status FROM public.installments WHERE id=${installment3}`;
  assert.equal(finalThird[0].status,"PENDING","FAILED insert must roll back status change");
  // Advance without installment ID remains unapplied; no installment is marked PAID.
  const advance=await recordPayment(db,{...payment,installmentId:null,amount:"0.01"});
  assert.equal(advance.installmentStatus,null);
  assert.equal(advance.receipt.installmentId,null);
  const p2=await owner`SELECT status FROM public.installments WHERE id=${installment3}`;
  assert.equal(p2[0].status,"PENDING");

  const finalRows=await owner`SELECT count(*)::int AS n FROM public.receipts WHERE tenant_id=${a}`;
  assert.equal(finalRows[0].n,3,"one cash + one advance + one bank receipt");
  console.log("PASS: 5 concurrent payments => 1 PAID receipt, 4 ALREADY_PAID; exact decimal, RLS, no partial, advance, rollback");
} finally {
  if(runtime)await runtime.end();
  try {
    if(fixturesCreated) {
      // Disposable foundation_test database only: append-only receipt rows cannot be DELETEd.\n      await owner`TRUNCATE TABLE public.receipt_cheque_events,public.receipts`;
      await owner`DELETE FROM public.installments WHERE tenant_id=${a}`;
      await owner`DELETE FROM public.contracts WHERE tenant_id=${a}`;
      await owner`DELETE FROM public.bookings WHERE tenant_id=${a}`;
      await owner`DELETE FROM public.units WHERE tenant_id=${a}`;
      await owner`DELETE FROM public.buildings WHERE tenant_id=${a}`;
      await owner`DELETE FROM public.phases WHERE tenant_id=${a}`;
      await owner`DELETE FROM public.projects WHERE tenant_id=${a}`;
      await owner`DELETE FROM public.users WHERE tenant_id=${a}`;
      await owner`DELETE FROM public.tenants WHERE tenant_id IN (${a},${b})`;
    }
  } finally {
    if(roleCreated)await owner.unsafe(`DROP ROLE ${role}`);
    await owner.end();
  }
}
