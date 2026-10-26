import Link from "next/link";
import { loadWorkspace, type WorkspaceListQuery } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { InventoryClient } from "@/components/workspace/inventory-client";
import { PaginationNav } from "@/components/workspace/pagination-nav";

export default async function InventoryPage({searchParams}:{searchParams:Promise<Omit<WorkspaceListQuery,"resource">>}) {
  const params=await searchParams;
  const d=await loadWorkspace({...params,resource:"units"});
  if(d.resource!=="units") throw new Error("Unexpected inventory query");
  return <>
    <PageHeader eyebrow="المخزون / INVENTORY" title="الوحدات والمخزون"
      description="تصفح الوحدات مع البحث وتقسيم النتائج من قاعدة البيانات."/>
    {d.session.role==="COMPANY_ADMIN"&&<div className="mb-5">
      <Link href="/inventory/manage" className="inline-flex rounded-xl bg-[#19776f] px-4 py-2 font-bold text-white">إضافة مشروع أو وحدة</Link>
    </div>}
    <InventoryClient projects={d.projects} phases={d.phases} buildings={d.buildings} initialUnits={d.rows}
      customers={[]} selectedProjectId={d.selectedProjectId} selectedPhaseId={d.selectedPhaseId}
      selectedBuildingId={d.selectedBuildingId} searchTerm={d.pagination.search}
      total={d.pagination.total} limit={d.pagination.limit}
      canBook={d.session.role!=="ACCOUNTANT"}/>
    <PaginationNav path="/inventory" {...d.pagination} params={{
      project:d.selectedProjectId??undefined,phase:d.selectedPhaseId??undefined,
      building:d.selectedBuildingId??undefined
    }}/>
  </>;
}
