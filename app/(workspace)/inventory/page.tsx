import { loadWorkspace } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { InventoryClient } from "@/components/workspace/inventory-client";
export default async function InventoryPage({searchParams}:{searchParams:Promise<{project?:string}>}) {
 const data=await loadWorkspace();
 const params=await searchParams;
 return <><PageHeader eyebrow="المخزون / INVENTORY" title="الوحدات والمخزون" description="تنقل بين المشروعات والمراحل والمباني. الحجز مرتبط بقاعدة البيانات في معاملة ذرية."/>
  <InventoryClient projects={data.projects} phases={data.phases} buildings={data.buildings} initialUnits={data.units} customers={data.customers.map(c=>({id:c.id,fullName:c.fullName,phonePrimary:c.phonePrimary}))}
     selectedProjectId={params.project??null} canBook={data.session.role!=="ACCOUNTANT"}/>
 </>;
}
