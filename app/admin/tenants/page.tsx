import { notFound } from "next/navigation";
import { getVerifiedWorkspaceSession } from "@/lib/workspace/server-data";
import { listPlatformTenants } from "@/lib/platform/administration";
import { TenantManager } from "@/components/admin/tenant-manager";
import { Sidebar } from "@/components/workspace/sidebar";
import { WorkspaceTopbar } from "@/components/workspace/topbar";
import { getServerI18n } from "@/lib/i18n/server";
export const dynamic="force-dynamic";
export default async function PlatformTenantsPage(){
 const identity=await getVerifiedWorkspaceSession();
 if(identity.role!=="PLATFORM_OWNER")notFound();
 const tenants=await listPlatformTenants();
 const {t}=await getServerI18n();
 return <div className="min-h-screen bg-[#f7faf9] md:flex" >
  <Sidebar companyName={identity.companyName} role={identity.role}/>
  <main className="min-w-0 flex-1 p-6 md:p-12">
   <div className="mx-auto max-w-6xl"><WorkspaceTopbar/>
    <header className="mb-8"><p className="text-xs font-bold tracking-widest text-teal-700">BUNYRA / PLATFORM</p>
     <h1 className="mt-2 text-3xl font-black text-[#173d37]">{t("pages.companyManagement")}</h1>
     <p className="mt-3 text-sm text-slate-600">{t("ui.platformDescription")}</p>
    </header>
    <TenantManager tenants={tenants.map(t=>({...t,users_count:Number(t.users_count),projects_count:Number(t.projects_count)}))}/>
   </div>
  </main>
 </div>;
}
