import {NextResponse} from "next/server";
import {verifyRequestIdentity} from "@/lib/auth/session";
import {getDatabase} from "@/lib/db/client";
import {createInventoryRecord,InventoryWriteError,type InventoryCreate} from "./create-record";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const decimal=/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const validName=(x:unknown)=>typeof x==="string"&&x.trim().length>0&&x.trim().length<=200;
export async function postInventory(request:Request,kind:InventoryCreate["kind"]){
 let identity:Awaited<ReturnType<typeof verifyRequestIdentity>>;
 try{identity=await verifyRequestIdentity(request);}catch{return NextResponse.json({error:"المصادقة غير متاحة"},{status:503});}
 if(!identity)return NextResponse.json({error:"يلزم تسجيل الدخول"},{status:401});
 if(!request.headers.get("content-type")?.startsWith("application/json"))
  return NextResponse.json({error:"JSON مطلوب"},{status:415});
 let raw:unknown;try{raw=await request.json();}catch{return NextResponse.json({error:"JSON غير صالح"},{status:400});}
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return NextResponse.json({error:"بيانات غير صالحة"},{status:400});
 const x=raw as Record<string,unknown>;
 const keys:Record<InventoryCreate["kind"],string[]>={
  project:["name","location"],phase:["project_id","name"],
  building:["phase_id","name"],unit:["building_id","unit_number","area","price"],
 };
 if(Object.keys(x).some(k=>!keys[kind].includes(k)))return NextResponse.json({error:"حقل غير مسموح"},{status:400});
 let data:InventoryCreate;
 if(kind==="project"){
  if(!validName(x.name)||typeof x.location!=="string"||x.location.length>300)
   return NextResponse.json({error:"اسم المشروع أو الموقع غير صالح"},{status:400});
  data={kind,name:(x.name as string).trim(),location:x.location.trim()};
 }else if(kind==="phase"){
  if(!validName(x.name)||typeof x.project_id!=="string"||!uuid.test(x.project_id))
   return NextResponse.json({error:"اسم المرحلة أو المشروع غير صالح"},{status:400});
  data={kind,name:(x.name as string).trim(),projectId:x.project_id};
 }else if(kind==="building"){
  if(!validName(x.name)||typeof x.phase_id!=="string"||!uuid.test(x.phase_id))
   return NextResponse.json({error:"اسم المبنى أو المرحلة غير صالح"},{status:400});
  data={kind,name:(x.name as string).trim(),phaseId:x.phase_id};
 }else{
  if(!validName(x.unit_number)||typeof x.building_id!=="string"||!uuid.test(x.building_id)||
   typeof x.area!=="string"||!decimal.test(x.area)||Number(x.area)<=0||
   typeof x.price!=="string"||!decimal.test(x.price))
   return NextResponse.json({error:"بيانات الوحدة أو الأسعار غير صالحة"},{status:400});
  data={kind,buildingId:x.building_id,unitNumber:(x.unit_number as string).trim(),area:x.area,price:x.price};
 }
 try{
  const created=await createInventoryRecord(getDatabase(),identity,data);
  return NextResponse.json({created},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){
  if(e instanceof InventoryWriteError)return NextResponse.json({code:e.code,error:e.message},{status:e.status});
  const cause=e instanceof Error&&"cause" in e?e.cause:e;
  if(cause&&typeof cause==="object"&&"code" in cause&&cause.code==="23505")
   return NextResponse.json({error:"القيمة مسجلة مسبقًا في نفس الشركة"},{status:409});
  console.error("Inventory creation error",e instanceof Error?e.name:"unknown");
  return NextResponse.json({error:"تعذر إنشاء السجل"},{status:500});
 }
}
