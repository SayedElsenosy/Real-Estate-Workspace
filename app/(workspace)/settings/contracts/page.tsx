import {loadWorkspace} from "@/lib/workspace/server-data";import {redirect} from "next/navigation";import {withTenantTransaction} from "@/lib/db/client";import {contractTemplates} from "@/lib/db/schema";import {TemplateUploader} from "@/components/workspace/template-uploader";import {PageHeader} from "@/components/workspace/page-header";import {Card} from "@/components/ui/card";
export default async function TemplatesPage(){
 const d=await loadWorkspace();if(d.session.role!=="COMPANY_ADMIN")redirect("/dashboard");
 const templates=await withTenantTransaction(d.session.tenantId,tx=>tx.select({id:contractTemplates.id,name:contractTemplates.name,isActive:contractTemplates.isActive}).from(contractTemplates));
 return <><PageHeader eyebrow="الإعدادات / CONTRACT TEMPLATES" title="قوالب العقود Word" description="ملفات DOCX خاصة بالشركة فقط."/><Card className="p-6"><TemplateUploader/></Card><Card className="mt-4 p-6"><h2 className="font-bold">القوالب المسجلة</h2>{templates.map(t=><p key={t.id} className="my-2">{t.name} — {t.isActive?"نشط":"متوقف"}</p>)}{!templates.length&&<p className="text-sm text-slate-500">لم تُرفع قوالب بعد.</p>}</Card>
 <p className="mt-5 text-sm text-amber-700">يستخدم تنزيل العقود آخر قالب نشط. لا يتم تخزين ملفات Word في مجلد public.</p></>;
}
