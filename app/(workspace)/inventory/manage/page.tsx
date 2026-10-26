import {redirect} from "next/navigation";import {loadWorkspace} from "@/lib/workspace/server-data";import {PageHeader} from "@/components/workspace/page-header";import {InventoryCreateForms} from "@/components/workspace/inventory-create-forms";
export default async function ManageInventory(){const data=await loadWorkspace();if(data.session.role!=="COMPANY_ADMIN")redirect("/inventory");
 return <><PageHeader eyebrow="المخزون / SETUP" title="إدخال المخزون" description="أنشئ المشروع، ثم المرحلة، ثم المبنى، ثم الوحدة."/>
 <InventoryCreateForms initialProjects={data.projects.map(p=>({id:p.id,name:p.name}))} initialPhases={data.phases} initialBuildings={data.buildings}/></>;}
