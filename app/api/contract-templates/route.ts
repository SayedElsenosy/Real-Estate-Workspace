import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import PizZip from "pizzip";
import {sql} from "drizzle-orm";
import {withTenantTransaction} from "@/lib/db/client";
import {templateAuth} from "@/lib/contracts/template-auth";
export const runtime="nodejs";
export async function POST(req:Request){
 const auth=await templateAuth(req);
 if("error" in auth)return NextResponse.json({error:auth.error},{status:auth.status});
 const form=await req.formData();
 const file=form.get("file"),name=form.get("name");
 if(!(file instanceof File)||file.size>5242880||file.size<1||typeof name!=="string")
 return NextResponse.json({error:"ملف Word غير صالح"},{status:400});
 const bytes=Buffer.from(await file.arrayBuffer());
 if(!new PizZip(bytes).file("word/document.xml"))return NextResponse.json({error:"ليس ملف DOCX"},{status:422});
 const id=randomUUID(),tenant=auth.identity.tenantId;
 await withTenantTransaction(tenant,async tx=>{
  await tx.execute(sql`INSERT INTO public.contract_templates(id,tenant_id,name,file_url,is_active) VALUES(${id},${tenant},${name},${"db://templates/"+id},true)`);
  await tx.execute(sql`INSERT INTO public.contract_template_files(template_id,tenant_id,content,size_bytes) VALUES(${id},${tenant},${bytes},${bytes.length})`);
 },auth.identity.id);
 return NextResponse.json({id},{status:201});
}
