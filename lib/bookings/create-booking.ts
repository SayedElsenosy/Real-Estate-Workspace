import { and, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import { bookings, customers, units, users } from "../db/schema";

export class BookingError extends Error {
 constructor(readonly code:"UNAUTHORIZED"|"FORBIDDEN"|"UNIT_NOT_FOUND"|"UNIT_UNAVAILABLE"|"CUSTOMER_NOT_FOUND"|"CUSTOMER_DUPLICATE",
 message:string,readonly httpStatus:number){super(message);this.name="BookingError";}
}
type Selection={customerId:string;newCustomer?:never}|{customerId?:never;newCustomer:{fullName:string;phonePrimary:string}};
export type NewBooking={tenantId:string;externalAuthId:string;unitId:string;expiresAt?:Date|null}&Selection;

export async function createConfirmedBooking(db:PostgresJsDatabase<typeof schema>,input:NewBooking){
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT set_config('app.tenant_id',${input.tenantId},true)`);
  const [actor]=await tx.select({id:users.id,role:users.role}).from(users).where(and(eq(users.tenantId,input.tenantId),eq(users.externalAuthId,input.externalAuthId))).limit(1);
  if(!actor)throw new BookingError("UNAUTHORIZED","حساب المستخدم غير مرتبط بالشركة",401);
  if(!["SALES","COMPANY_ADMIN"].includes(actor.role))throw new BookingError("FORBIDDEN","ليس لديك صلاحية الحجز",403);
  await tx.execute(sql`select set_config('app.actor_id',${actor.id},true)`);
  const [unit]=await tx.select({status:units.status}).from(units)
   .where(and(eq(units.tenantId,input.tenantId),eq(units.id,input.unitId))).for("update").limit(1);
  if(!unit)throw new BookingError("UNIT_NOT_FOUND","الوحدة غير موجودة",404);
  if(unit.status!=="AVAILABLE")throw new BookingError("UNIT_UNAVAILABLE","الوحدة محجوزة بالفعل",409);

  let customer:{id:string;fullName:string;phonePrimary:string}|undefined;
  if(input.customerId){
   [customer]=await tx.select({id:customers.id,fullName:customers.fullName,phonePrimary:customers.phonePrimary})
    .from(customers).where(and(eq(customers.tenantId,input.tenantId),eq(customers.id,input.customerId))).limit(1);
   if(!customer)throw new BookingError("CUSTOMER_NOT_FOUND","العميل غير موجود في الشركة",404);
  }else if(input.newCustomer){
   const fullName=input.newCustomer.fullName.trim(),phonePrimary=input.newCustomer.phonePrimary.trim();
   if(fullName.length<2||fullName.length>200||phonePrimary.length<6||phonePrimary.length>30)
    throw new BookingError("CUSTOMER_NOT_FOUND","بيانات العميل غير صالحة",422);
   // Insert customer IN SAME transaction. A failed booking rolls the customer insert back.
   const [created]=await tx.insert(customers).values({tenantId:input.tenantId,fullName,phonePrimary})
    .onConflictDoNothing({target:[customers.tenantId,customers.phonePrimary]})
    .returning({id:customers.id,fullName:customers.fullName,phonePrimary:customers.phonePrimary});
   if(!created)throw new BookingError("CUSTOMER_DUPLICATE","رقم الهاتف مسجل بالفعل؛ اختر العميل من القائمة",409);
   customer=created;
  }
  if(!customer)throw new BookingError("CUSTOMER_NOT_FOUND","يجب اختيار عميل",422);
  await tx.update(units).set({status:"BOOKED"}).where(and(eq(units.tenantId,input.tenantId),eq(units.id,input.unitId)));
  const [booking]=await tx.insert(bookings).values({
   tenantId:input.tenantId,unitId:input.unitId,customerId:customer.id,
   customerName:customer.fullName,customerPhone:customer.phonePrimary,
   status:"CONFIRMED",expiresAt:input.expiresAt??null,
  }).returning({id:bookings.id,unitId:bookings.unitId,customerId:bookings.customerId,status:bookings.status,bookingDate:bookings.bookingDate});
  return {booking,unitStatus:"BOOKED" as const};
 });
}
