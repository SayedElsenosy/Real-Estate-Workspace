import {and,eq,sql} from "drizzle-orm";
import type {PostgresJsDatabase} from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import {bookings,contracts,units,users} from "../db/schema";
export class BookingCancellationError extends Error{
 constructor(readonly code:string,message:string,readonly httpStatus:number){super(message);this.name="BookingCancellationError";}
}
export async function cancelConfirmedBooking(db:PostgresJsDatabase<typeof schema>,input:{tenantId:string;externalAuthId:string;bookingId:string}){
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT set_config('app.tenant_id',${input.tenantId},true)`);
  const [actor]=await tx.select({id:users.id,role:users.role}).from(users).where(and(eq(users.tenantId,input.tenantId),eq(users.externalAuthId,input.externalAuthId))).limit(1);
  if(!actor||actor.role!=="COMPANY_ADMIN")throw new BookingCancellationError("FORBIDDEN","إلغاء الحجز متاح لمدير الشركة فقط",403);
  await tx.execute(sql`select set_config('app.actor_id',${actor.id},true)`);
  const [booking]=await tx.select({id:bookings.id,status:bookings.status,unitId:bookings.unitId})
   .from(bookings).where(and(eq(bookings.tenantId,input.tenantId),eq(bookings.id,input.bookingId))).for("update").limit(1);
  if(!booking)throw new BookingCancellationError("NOT_FOUND","الحجز غير موجود",404);
  if(booking.status!=="CONFIRMED")throw new BookingCancellationError("NOT_CONFIRMED","لا يمكن إلغاء الحجز بهذه الحالة",409);
  const related=await tx.select({status:contracts.status}).from(contracts)
   .where(and(eq(contracts.tenantId,input.tenantId),eq(contracts.bookingId,booking.id)));
  if(related.some(c=>c.status!=="CANCELLED"))
   throw new BookingCancellationError("ACTIVE_CONTRACT","يجب إلغاء العقد المرتبط أولًا",409);
  const [unit]=await tx.select({id:units.id,status:units.status}).from(units)
   .where(and(eq(units.tenantId,input.tenantId),eq(units.id,booking.unitId))).for("update").limit(1);
  if(!unit||unit.status!=="BOOKED")
   throw new BookingCancellationError("UNIT_CONFLICT","حالة الوحدة غير متوافقة مع الإلغاء",409);
  await tx.update(bookings).set({status:"CANCELLED"}).where(and(eq(bookings.tenantId,input.tenantId),eq(bookings.id,booking.id)));
  await tx.update(units).set({status:"AVAILABLE"}).where(and(eq(units.tenantId,input.tenantId),eq(units.id,unit.id)));
  return {bookingId:booking.id,bookingStatus:"CANCELLED",unitId:unit.id,unitStatus:"AVAILABLE"};
 });
}
