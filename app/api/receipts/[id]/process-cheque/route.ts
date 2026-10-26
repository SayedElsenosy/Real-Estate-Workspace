import {NextResponse} from "next/server";
import {getDatabase} from "@/lib/db/client";
import {verifyRequestIdentity} from "@/lib/auth/session";
import {ChequeError,processChequeStatus} from "@/lib/finance/process-cheque";
export const runtime="nodejs";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!UUID.test(id))return NextResponse.json({error:"معرف غير صالح"},{status:400});
 let identity:Awaited<ReturnType<typeof verifyRequestIdentity>>;
 try{identity=await verifyRequestIdentity(req);}catch{return NextResponse.json({error:"المصادقة غير متاحة"},{status:503});}
 if(!identity)return NextResponse.json({error:"يلزم تسجيل الدخول"},{status:401});
 let payload:unknown;
 try{payload=await req.json();}catch{return NextResponse.json({error:"JSON غير صالح"},{status:400});}
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return NextResponse.json({error:"طلب غير صالح"},{status:400});
 const body=payload as Record<string,unknown>;
 if(Object.keys(body).some(k=>!["new_status","reason"].includes(k))||
  !["CLEARED","BOUNCED"].includes(String(body.new_status))||
  (body.reason!==undefined&&typeof body.reason!=="string"))
  return NextResponse.json({error:"الحقول غير صالحة"},{status:400});
 try{
 const result=await processChequeStatus(getDatabase(),{tenantId:identity.tenantId,externalAuthId:identity.externalAuthId,
 receiptId:id,newStatus:body.new_status as "CLEARED"|"BOUNCED",reason:body.reason as string|undefined});
 return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(e){
 if(e instanceof ChequeError)return NextResponse.json({code:e.code,error:e.message},{status:e.status});
 console.error("Cheque processing failed",e instanceof Error?e.name:"unknown");
 return NextResponse.json({error:"تعذرت معالجة الشيك"},{status:500});
 }
}
