import {getServerI18n} from "@/lib/i18n/server";
import {loadWorkspace} from "@/lib/workspace/server-data";import {redirect} from "next/navigation";import {withTenantTransaction} from "@/lib/db/client";import {contractTemplates} from "@/lib/db/schema";import {TemplateUploader} from "@/components/workspace/template-uploader";import {PageHeader} from "@/components/workspace/page-header";import {Card} from "@/components/ui/card";
export default async function TemplatesPage(){
 const {t}=await getServerI18n();const d=await loadWorkspace();if(d.session.role!=="COMPANY_ADMIN")redirect("/dashboard");
 const templates=await withTenantTransaction(d.session.tenantId,tx=>tx.select({id:contractTemplates.id,name:contractTemplates.name,isActive:contractTemplates.isActive}).from(contractTemplates));
 return <><PageHeader eyebrow="الإعدادات / CONTRACT TEMPLATES" title={t("pages.templates")} description={t("ui.templatesDescription")}/><Card className="p-6"><TemplateUploader/></Card><Card className="mt-4 p-6"><h2 className="font-bold">{t("ui.registeredTemplates")}</h2>{templates.map(template=><p key={template.id} className="my-2">{template.name} — {template.isActive?t("ui.active"):t("ui.suspended")}</p>)}{!templates.length&&<p className="text-sm text-slate-500">{t("ui.noTemplates")}</p>}</Card>
 <p className="mt-5 text-sm text-amber-700">{t("ui.templateWarning")}</p></>;
}
