import { notFound } from "next/navigation";
import { getVerifiedWorkspaceSession } from "@/lib/workspace/server-data";
import { listPlatformTenants } from "@/lib/platform/administration";
import { TenantManager } from "@/components/admin/tenant-manager";
import { Sidebar } from "@/components/workspace/sidebar";
export const dynamic="force-dynamic";
export default async function PlatformTenantsPage(){
 const identity=await getVerifiedWorkspaceSession();
 if(identity.role!=="PLATFORM_OWNER")notFound();
 const tenants=await listPlatformTenants();
 return <div className="min-h-screen bg-[#f7faf9] md:flex" dir="rtl">
  <Sidebar companyName={identity.companyName} role={identity.role}/>
  <main className="min-w-0 flex-1 p-6 md:p-12">
   <div className="mx-auto max-w-6xl">
    <header className="mb-8"><p className="text-xs font-bold tracking-widest text-teal-700">BUNYRA / PLATFORM</p>
     <h1 className="mt-2 text-3xl font-black text-[#173d37]">إدارة شركات المنصة</h1>
     <p className="mt-3 text-sm text-slate-600">متاحة لمالك المنصة فقط؛ كل إجراء مسجل بهوية المستخدم ويُتحقق منه داخل PostgreSQL.</p>
    </header>
    <TenantManager tenants={tenants.map(t=>({...t,users_count:Number(t.users_count),projects_count:Number(t.projects_count)}))}/>
   </div>
  </main>
 </div>;
}
