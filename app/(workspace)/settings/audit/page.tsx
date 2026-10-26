import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { getVerifiedWorkspaceSession } from "@/lib/workspace/server-data";
import { withTenantTransaction } from "@/lib/db/client";
import { PageHeader } from "@/components/workspace/page-header";
import { Card } from "@/components/ui/card";
import { PaginationNav,TableSearch } from "@/components/workspace/pagination-nav";
import { getServerI18n } from "@/lib/i18n/server";
export const dynamic="force-dynamic";
type Entry={id:string;user_id:string|null;user_name:string|null;action:string;entity_type:string;entity_id:string;old_values:Record<string,unknown>|null;new_values:Record<string,unknown>|null;created_at:Date};
export default async function AuditPage({searchParams}:{searchParams:Promise<{page?:string;search?:string}>}){
 const session=await getVerifiedWorkspaceSession();
 if(session.role!=="COMPANY_ADMIN")notFound();
 const p=await searchParams;
 const n=Number(p.page),page=Number.isSafeInteger(n)&&n>0?Math.min(n,100000):1;
 const limit=25,search=String(p.search??"").trim().slice(0,100);
 const pattern="%"+search.replace(/[\\%_]/g,"\\$&")+"%";
 const result=await withTenantTransaction(session.tenantId,async tx=>{
  const [countRows,entries]=await Promise.all([
   tx.execute<{total:number}>(sql`SELECT count(*)::int AS total FROM public.audit_logs a
     WHERE a.tenant_id=${session.tenantId}::uuid
     AND (${search}='' OR a.entity_type ILIKE ${pattern} OR a.action ILIKE ${pattern})`),
   tx.execute<Entry>(sql`SELECT a.id,a.user_id,u.full_name AS user_name,a.action,a.entity_type,a.entity_id,
     a.old_values,a.new_values,a.created_at
     FROM public.audit_logs a LEFT JOIN public.users u ON u.id=a.user_id
     WHERE a.tenant_id=${session.tenantId}::uuid
     AND (${search}='' OR a.entity_type ILIKE ${pattern} OR a.action ILIKE ${pattern})
     ORDER BY a.created_at DESC,a.id DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`)
  ]);
  return {total:countRows[0]?.total??0,entries};
 },session.id);
 const {t,locale}=await getServerI18n();
 const actions:Record<string,string>={
  INSERT:t("ui.auditInsert"),UPDATE:t("ui.auditUpdate"),DELETE:t("ui.auditDelete")
 };
 const entities:Record<string,string>={
  projects:t("ui.auditProjects"),phases:t("ui.auditPhases"),buildings:t("ui.auditBuildings"),
  units:t("ui.auditUnits"),customers:t("ui.auditCustomers"),bookings:t("ui.auditBookings"),
  contracts:t("ui.auditContracts"),installments:t("ui.auditInstallments"),
  receipts:t("ui.auditReceipts"),receipt_cheque_events:t("ui.auditChequeEvents"),
  contract_templates:t("ui.auditTemplates")
 };
 return <><PageHeader eyebrow="SECURITY / AUDIT" title={t("audit.title")}
   description={t("audit.description")}/>
   <div className="mb-5"><TableSearch path="/settings/audit" search={search} placeholder={t("audit.search")}/></div>
   <Card className="overflow-x-auto">
    <table className="w-full text-sm"><thead><tr className="border-b text-start">
      {[t("audit.date"),t("audit.actor"),t("audit.action"),t("audit.entity"),t("audit.change")].map(h=><th className="p-4 text-start" key={h}>{h}</th>)}
    </tr></thead><tbody>{result.entries.map(a=><tr className="border-b" key={a.id}>
      <td className="p-4 whitespace-nowrap" dir="ltr">{new Date(a.created_at).toLocaleString(locale==="ar"?"ar-EG":"en-US")}</td>
      <td className="p-4">{a.user_name??t("audit.system")}</td><td className="p-4">{actions[a.action]??a.action}</td>
      <td className="p-4"><strong>{entities[a.entity_type]??a.entity_type}</strong><p className="text-xs text-slate-500" dir="ltr">{a.entity_id.slice(0,8)}</p></td>
      <td className="p-4"><details><summary className="cursor-pointer text-teal-700">{t("audit.details")}</summary>
        <pre dir="ltr" className="mt-2 max-h-64 max-w-[360px] overflow-auto rounded-lg bg-slate-100 p-2 text-xs text-slate-900">
          {JSON.stringify({old:a.old_values,new:a.new_values},null,2)}
        </pre>
      </details></td>
    </tr>)}</tbody></table>
    {!result.entries.length&&<p className="p-7 text-sm text-slate-500">{t("audit.empty")}</p>}
   </Card>
   <PaginationNav path="/settings/audit" page={page} total={result.total} limit={limit} search={search}/>
 </>;
}
