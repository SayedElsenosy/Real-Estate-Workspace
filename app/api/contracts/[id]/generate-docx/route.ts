import {NextResponse} from "next/server";
import {and,eq,sql} from "drizzle-orm";
import {templateAuth} from "@/lib/contracts/template-auth";
import {withTenantTransaction} from "@/lib/db/client";
import {bookings,buildings,contracts,customers,installments,phases,projects,units,contractTemplates} from "@/lib/db/schema";
import {generateContractDocx} from "@/lib/contracts/generate-contract-docx";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!uuid.test(id))return NextResponse.json({error:"معرف العقد غير صالح"},{status:400});
 const auth=await templateAuth(req,["COMPANY_ADMIN","ACCOUNTANT"]);
 if("error" in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 try{
 const tenant=auth.identity.tenantId;
 const data=await withTenantTransaction(tenant,async tx=>{
  const [contract]=await tx.select().from(contracts).where(and(eq(contracts.tenantId,tenant),eq(contracts.id,id))).limit(1);
  if(!contract)return null;
  const [booking]=await tx.select().from(bookings).where(and(eq(bookings.tenantId,tenant),eq(bookings.id,contract.bookingId))).limit(1);
  if(!booking)return null;
  const [unit]=await tx.select().from(units).where(and(eq(units.tenantId,tenant),eq(units.id,booking.unitId))).limit(1);
  if(!unit)return null;
  const [building]=await tx.select().from(buildings).where(and(eq(buildings.tenantId,tenant),eq(buildings.id,unit.buildingId))).limit(1);
  const [phase]=building?await tx.select().from(phases).where(and(eq(phases.tenantId,tenant),eq(phases.id,building.phaseId))).limit(1):[];
  const [project]=phase?await tx.select().from(projects).where(and(eq(projects.tenantId,tenant),eq(projects.id,phase.projectId))).limit(1):[];
  const [customer]=booking.customerId?await tx.select().from(customers).where(and(eq(customers.tenantId,tenant),eq(customers.id,booking.customerId))).limit(1):[];
  const schedule=await tx.select().from(installments).where(and(eq(installments.tenantId,tenant),eq(installments.contractId,id))).orderBy(installments.sequence);
  const [template]=await tx.select({id:contractTemplates.id}).from(contractTemplates).where(and(eq(contractTemplates.tenantId,tenant),eq(contractTemplates.isActive,true))).orderBy(sql`created_at DESC`).limit(1);
  if(!template)return {missingTemplate:true} as const;
  const raw=await tx.execute(sql`SELECT content FROM public.contract_template_files WHERE tenant_id=${tenant} AND template_id=${template.id}`);
  if(!raw.length)return {missingTemplate:true} as const;
  return {templateBytes:raw[0].content as Buffer,customerName:customer?.fullName||booking.customerName,
    phone:customer?.phonePrimary||booking.customerPhone,unitNumber:unit.unitNumber,projectName:project?.name||"—",
    total:contract.totalAmount,plan:contract.paymentPlanSnapshot,schedule};
 });
 if(!data)return NextResponse.json({error:"العقد غير موجود"},{status:404});
 if("missingTemplate" in data)return NextResponse.json({error:"ارفع قالب Word نشطًا من الإعدادات أولًا"},{status:409});
 const bytes=Buffer.isBuffer(data.templateBytes)?data.templateBytes:Buffer.from(data.templateBytes);
 const content=generateContractDocx(bytes,{
 customer_name:data.customerName,customer_phone:data.phone,unit_number:data.unitNumber,
 project_name:data.projectName,total_amount:data.total,
 installment_plan:`${data.plan.downPaymentPercent}% / ${data.plan.installmentCount} أقساط / كل ${data.plan.intervalMonths} شهر`,
 installments:data.schedule.map(i=>({sequence:i.sequence,due_date:i.dueDate,amount:i.amount})),
 });
 return new Response(new Uint8Array(content),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "Content-Disposition":`attachment; filename="contract-${id.slice(0,8)}.docx"`,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch(error){console.error("DOCX generation failed",error instanceof Error?error.name:"unknown");return NextResponse.json({error:"تعذر إنشاء العقد Word؛ تحقق من سلامة القالب"},{status:422});}
}
