import Link from "next/link";
import { ArrowUpLeft, Building2, MapPin } from "lucide-react";
import { loadWorkspace } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/workspace/status-badge";
export default async function ProjectsPage(){
 const data=await loadWorkspace();
 return <><PageHeader eyebrow="المشروعات / PROJECTS" title="المشروعات العقارية" description="اختر مشروعًا للانتقال إلى مراحله ومبانيه والوحدات المتاحة فيه."/>
  {data.session.role==="COMPANY_ADMIN"&&<div className="mb-5"><Link href="/inventory/manage" className="inline-flex rounded-xl bg-[#19776f] px-5 py-3 text-sm font-bold text-white">إضافة مخزون جديد</Link></div>}
  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.projects.map((project,i)=>{
    const phaseIds=data.phases.filter(x=>x.projectId===project.id).map(x=>x.id);
    const bIds=data.buildings.filter(x=>phaseIds.includes(x.phaseId)).map(x=>x.id);
    const count=data.units.filter(x=>bIds.includes(x.buildingId)).length;
    return <Link key={project.id} href={`/inventory?project=${project.id}`} className="group">
     <Card className="overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg">
       <div className={`h-28 bg-gradient-to-l ${i%2===0?"from-[#196b64] to-[#7eb8a4]":"from-[#34504b] to-[#92ac9c]"} p-5`}><Building2 className="size-10 text-white/80"/></div>
       <div className="space-y-4 p-6"><div className="flex items-start justify-between gap-2"><h3 className="text-xl font-bold text-[#183e37]">{project.name}</h3><StatusBadge status={project.status}/></div>
        <p className="flex items-center gap-2 text-sm text-[#80948d]"><MapPin className="size-4"/>{project.location||"الموقع غير محدد"}</p>
        <div className="flex items-center justify-between border-t border-[#edf1ef] pt-4 text-sm"><span className="text-[#839690]">{count} وحدة</span><span className="flex items-center gap-1 font-bold text-[#197b70]">عرض الوحدات <ArrowUpLeft className="size-4"/></span></div>
       </div>
     </Card></Link>;
  })}</div>{data.projects.length===0&&<p className="rounded-2xl border border-dashed border-[#cadbd6] p-12 text-center text-[#7d928b]">لا توجد مشروعات مضافة.</p>}
 </>;
}
