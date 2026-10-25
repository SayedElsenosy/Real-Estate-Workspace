import {NextResponse} from "next/server";
import {getDatabase} from "@/lib/db/client";
import {verifyRequestIdentity} from "@/lib/auth/mock-session";
import {cancelConfirmedBooking,BookingCancellationError} from "@/lib/bookings/cancel-booking";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!uuid.test(id))return NextResponse.json({error:"معرف الحجز غير صالح"},{status:400});
 let identity:Awaited<ReturnType<typeof verifyRequestIdentity>>;
 try{identity=await verifyRequestIdentity(request);}catch{return NextResponse.json({error:"المصادقة غير متاحة"},{status:503});}
 if(!identity)return NextResponse.json({error:"يلزم تسجيل الدخول"},{status:401});
 try{
 const result=await cancelConfirmedBooking(getDatabase(),{tenantId:identity.tenantId,externalAuthId:identity.externalAuthId,bookingId:id});
 return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(e){
 if(e instanceof BookingCancellationError)return NextResponse.json({code:e.code,error:e.message},{status:e.httpStatus});
 console.error("Booking cancellation failed",e instanceof Error?e.name:"unknown");return NextResponse.json({error:"تعذر إلغاء الحجز"},{status:500});
 }
}
