import Link from "next/link";
import { redirect } from "next/navigation";
import { getVerifiedWorkspaceSession } from "@/lib/workspace/server-data";
import { Building2, Blocks, BadgeCheck, ArrowUpLeft, CalendarCheck2, Wallet, MoveLeft } from "lucide-react";
import { getDashboardStats } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { getServerI18n } from "@/lib/i18n/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/workspace/status-badge";
import { money } from "@/lib/utils";
export default async function DashboardPage(){
 const identity=await getVerifiedWorkspaceSession();
 if(identity.role==="PLATFORM_OWNER")redirect("/admin/tenants");
 const data=await getDashboardStats();
 const {t}=await getServerI18n();
 const metrics=[
  {label:t("dashboard.projects"),value:String(data.projectsCount),icon:Building2},
  {label:t("dashboard.available"),value:String(data.availableUnits),icon:Blocks},
  {label:t("dashboard.activeContracts"),value:String(data.activeContracts),icon:BadgeCheck},
  {label:t("dashboard.sales"),value:money(data.totalSales),icon:Wallet},
 ];
 return <>
  <PageHeader eyebrow={t("dashboard.eyebrow")} title={t("dashboard.title")} description={t("dashboard.welcome",{company:data.session.companyName})}
    action={<Button asChild><Link href="/inventory">{t("dashboard.browse")} <ArrowUpLeft className="size-4"/></Link></Button>}/>
  <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
   {metrics.map(({label,value,icon:Icon})=><Card key={label} className="p-6"><div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-[#e7f3ef] text-[#188277]"><Icon className="size-5"/></div><p className="text-sm text-[#859994]">{label}</p><p className="mt-2 text-2xl font-black text-[#163d37]" dir="auto">{value}</p></Card>)}
  </section>
  <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
    <Card className="p-6">
     <div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-bold text-[#153d37]">{t("dashboard.companyProjects")}</h2><Link href="/projects" className="flex items-center gap-1 text-sm font-bold text-[#198277]">{t("dashboard.allProjects")} <MoveLeft className="size-4"/></Link></div>
     <div className="space-y-3">{data.featuredProjects.map(p=><Link href={`/inventory?project=${p.id}`} key={p.id} className="flex items-center justify-between rounded-xl border border-[#e9eeec] p-4 hover:bg-[#f7fbf9]"><div><p className="font-bold text-[#1c4640]">{p.name}</p><p className="mt-1 text-xs text-[#90a19d]">{p.location}</p></div><StatusBadge status={p.status}/></Link>)}{data.projectsCount===0&&<p className="text-sm text-[#8c9e99]">{t("dashboard.noProjects")}</p>}</div>
    </Card>
    <Card className="p-6"><h2 className="mb-5 text-lg font-bold text-[#153d37]">{t("dashboard.activity")}</h2>
      <div className="space-y-5">
       <div className="flex items-center gap-3"><div className="rounded-xl bg-[#e9f4f1] p-3 text-[#238c7d]"><CalendarCheck2 className="size-5"/></div><div><p className="text-sm font-semibold">{t("dashboard.bookings")}</p><p className="text-xs text-[#869a95]">{t("dashboard.bookingRegistered",{count:data.bookingsCount})}</p></div></div>
       <div className="flex items-center gap-3"><div className="rounded-xl bg-[#f2eee6] p-3 text-[#a4844e]"><Wallet className="size-5"/></div><div><p className="text-sm font-semibold">{t("dashboard.receipts")}</p><p className="text-xs text-[#869a95]">{t("dashboard.receiptRegistered",{count:data.receiptsCount})}</p></div></div>
      </div>
      <p className="mt-8 rounded-xl bg-[#f1f8f6] p-4 text-xs leading-6 text-[#5a7d75]">{t("ui.summaryPostgres")}</p>
    </Card>
  </div>
 </>;
}
