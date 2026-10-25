import {and,eq,sql} from "drizzle-orm";
import type {PostgresJsDatabase} from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import {contracts,installments,receipts,users} from "../db/schema";

export class ChequeError extends Error {
 constructor(readonly code:string,message:string,readonly status:number){super(message);this.name="ChequeError";}
}
export type ChequeInput={
 tenantId:string;externalAuthId:string;receiptId:string;
 newStatus:"CLEARED"|"BOUNCED";reason?:string;
};
/** Lock order must match recordPayment: contract -> receipt -> installment. */
export async function processChequeStatus(db:PostgresJsDatabase<typeof schema>,input:ChequeInput){
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT set_config('app.tenant_id',${input.tenantId},true)`);
  const [actor]=await tx.select({role:users.role}).from(users)
   .where(and(eq(users.tenantId,input.tenantId),eq(users.externalAuthId,input.externalAuthId))).limit(1);
  if(!actor||!["COMPANY_ADMIN","ACCOUNTANT"].includes(actor.role))
   throw new ChequeError("FORBIDDEN","ليس لديك صلاحية معالجة الشيكات",403);
  if(input.newStatus==="BOUNCED"&&(!input.reason?.trim()||input.reason.trim().length>1000))
   throw new ChequeError("REASON_REQUIRED","سبب ارتداد الشيك مطلوب",422);
  const [candidate]=await tx.select({id:receipts.id,contractId:receipts.contractId}).from(receipts)
   .where(and(eq(receipts.tenantId,input.tenantId),eq(receipts.id,input.receiptId))).limit(1);
  if(!candidate)throw new ChequeError("NOT_FOUND","الإيصال غير موجود",404);
  const [contract]=await tx.select({id:contracts.id}).from(contracts)
   .where(and(eq(contracts.tenantId,input.tenantId),eq(contracts.id,candidate.contractId))).for("update").limit(1);
  if(!contract)throw new ChequeError("NOT_FOUND","العقد غير موجود",404);
  const [receipt]=await tx.select().from(receipts)
   .where(and(eq(receipts.tenantId,input.tenantId),eq(receipts.id,input.receiptId))).for("update").limit(1);
  if(!receipt||receipt.method!=="CHEQUE")
   throw new ChequeError("NOT_CHEQUE","هذه العملية متاحة للشيكات فقط",422);
  if(receipt.chequeClearanceStatus!=="PENDING")
   throw new ChequeError("ALREADY_PROCESSED","تمت معالجة الشيك بالفعل",409);
  if(input.newStatus==="BOUNCED"&&receipt.installmentId){
   const [i]=await tx.select({id:installments.id,status:installments.status}).from(installments)
    .where(and(eq(installments.tenantId,input.tenantId),eq(installments.contractId,receipt.contractId),eq(installments.id,receipt.installmentId))).for("update").limit(1);
   if(!i||i.status!=="PAID")
    throw new ChequeError("STATUS_CONFLICT","لا يمكن إرجاع القسط: حالته الحالية غير متوقعة",409);
   await tx.update(installments).set({status:"OVERDUE"}).where(and(eq(installments.tenantId,input.tenantId),eq(installments.id,i.id)));
  }
  const [updated]=await tx.update(receipts).set({
   chequeClearanceStatus:input.newStatus,
   bouncedReason:input.newStatus==="BOUNCED"?input.reason!.trim():null,
   bouncedAt:input.newStatus==="BOUNCED"?new Date():null,
  }).where(and(eq(receipts.tenantId,input.tenantId),eq(receipts.id,receipt.id)))
   .returning({id:receipts.id,chequeClearanceStatus:receipts.chequeClearanceStatus,installmentId:receipts.installmentId});
  return {receipt:updated,installmentStatus:input.newStatus==="BOUNCED"&&receipt.installmentId?"OVERDUE":null};
 });
}
