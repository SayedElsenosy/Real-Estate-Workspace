import {and,eq,sql} from "drizzle-orm";
import type {PostgresJsDatabase} from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import {contracts,installments,receipts,receiptChequeEvents,users} from "../db/schema";

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
  const [actor]=await tx.select({id:users.id,role:users.role}).from(users)
   .where(and(eq(users.tenantId,input.tenantId),eq(users.externalAuthId,input.externalAuthId))).limit(1);
  if(!actor||!["COMPANY_ADMIN","ACCOUNTANT"].includes(actor.role))
   throw new ChequeError("FORBIDDEN","ليس لديك صلاحية معالجة الشيكات",403);
  await tx.execute(sql`select set_config('app.actor_id',${actor.id},true)`);
  if(input.newStatus==="BOUNCED"&&(!input.reason?.trim()||input.reason.trim().length>1000))
   throw new ChequeError("REASON_REQUIRED","سبب ارتداد الشيك مطلوب",422);
  const [candidate]=await tx.select({id:receipts.id,contractId:receipts.contractId}).from(receipts)
   .where(and(eq(receipts.tenantId,input.tenantId),eq(receipts.id,input.receiptId))).limit(1);
  if(!candidate)throw new ChequeError("NOT_FOUND","الإيصال غير موجود",404);
  const [contract]=await tx.select({id:contracts.id}).from(contracts)
   .where(and(eq(contracts.tenantId,input.tenantId),eq(contracts.id,candidate.contractId))).for("update").limit(1);
  if(!contract)throw new ChequeError("NOT_FOUND","العقد غير موجود",404);
  const [receipt]=await tx.select().from(receipts)
   .where(and(eq(receipts.tenantId,input.tenantId),eq(receipts.id,input.receiptId))).limit(1);
  if(!receipt||receipt.method!=="CHEQUE")
   throw new ChequeError("NOT_CHEQUE","هذه العملية متاحة للشيكات فقط",422);
  const [resolved]=await tx.select({id:receiptChequeEvents.id}).from(receiptChequeEvents).where(and(eq(receiptChequeEvents.tenantId,input.tenantId),eq(receiptChequeEvents.receiptId,receipt.id))).limit(1);
  if(receipt.chequeClearanceStatus!=="PENDING"||resolved)
   throw new ChequeError("ALREADY_PROCESSED","تمت معالجة الشيك بالفعل",409);
  if(input.newStatus==="BOUNCED"&&receipt.installmentId){
   const [i]=await tx.select({id:installments.id,status:installments.status}).from(installments)
    .where(and(eq(installments.tenantId,input.tenantId),eq(installments.contractId,receipt.contractId),eq(installments.id,receipt.installmentId))).for("update").limit(1);
   if(!i||i.status!=="PAID")
    throw new ChequeError("STATUS_CONFLICT","لا يمكن إرجاع القسط: حالته الحالية غير متوقعة",409);
   await tx.update(installments).set({status:"OVERDUE"}).where(and(eq(installments.tenantId,input.tenantId),eq(installments.id,i.id)));
  }
  const [updated]=await tx.insert(receiptChequeEvents).values({
   tenantId:input.tenantId,receiptId:receipt.id,newStatus:input.newStatus,
   reason:input.newStatus==="BOUNCED"?input.reason!.trim():null,
  }).onConflictDoNothing({target:[receiptChequeEvents.tenantId,receiptChequeEvents.receiptId]})
   .returning({id:receiptChequeEvents.receiptId,newStatus:receiptChequeEvents.newStatus});
  if(!updated)throw new ChequeError("ALREADY_PROCESSED","تمت معالجة الشيك بالفعل",409);
  return {receipt:{id:receipt.id,chequeClearanceStatus:updated.newStatus,installmentId:receipt.installmentId},installmentStatus:input.newStatus==="BOUNCED"&&receipt.installmentId?"OVERDUE":null};
 });
}
