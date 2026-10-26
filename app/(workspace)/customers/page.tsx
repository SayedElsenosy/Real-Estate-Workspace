import { loadWorkspace, type WorkspaceListQuery } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { getServerI18n } from "@/lib/i18n/server";
import { PaginationNav, TableSearch } from "@/components/workspace/pagination-nav";
import { CustomersSearch } from "@/components/workspace/customers-search";
export default async function CustomersPage({searchParams}:{searchParams:Promise<Omit<WorkspaceListQuery,"resource">>}) {
  const d=await loadWorkspace({...await searchParams,resource:"customers"});
  const {t}=await getServerI18n();
  if(d.resource!=="customers") throw new Error("Unexpected customers query");
  return <><PageHeader eyebrow="العملاء / CRM" title={t("pages.customers")} description="سجل العملاء مع البحث المباشر داخل PostgreSQL."/>
    <div className="mb-4"><TableSearch path="/customers" search={d.pagination.search} placeholder="اسم أو هاتف أو بريد العميل"/></div>
    <CustomersSearch customers={d.rows} total={d.pagination.total}/>
    <PaginationNav path="/customers" {...d.pagination}/>
  </>;
}
