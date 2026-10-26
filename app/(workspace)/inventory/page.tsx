import Link from "next/link";
import { loadWorkspace } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { InventoryClient } from "@/components/workspace/inventory-client";
export default async function InventoryPage({searchParams}:{searchParams:Promise<{project?:string}>}) {
 const data=await loadWorkspace();
 const params=await searchParams;
 return <><PageHeader eyebrow="المخزون / INVENTORY" title="الوحدات والمخزون" description="تنقل بين المشروعات والمراحل والمباني. الحجز مرتبط بقاعدة البيانات في معاملة ذرية."/>
  {data.session.role==="COMPANY_ADMIN"&&<div className="mb-5"><Link href="/inventory/manage" className="inline-flex rounded-xl bg-[#19776f] px-4 py-2 font-bold text-white">إضافة مشروع أو وحدة</Link></div>}
  <InventoryClient projects={data.projects} phases={data.phases} buildings={data.buildings} initialUnits={data.units} customers={data.customers.map(c=>({id:c.id,fullName:c.fullName,phonePrimary:c.phonePrimary}))}
     selectedProjectId={params.project??null} canBook={data.session.role!=="ACCOUNTANT"}/>
 </>;
}
