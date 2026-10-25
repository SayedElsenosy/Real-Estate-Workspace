import Link from "next/link";
import { Building2, Blocks, BadgeCheck, ArrowUpLeft, CalendarCheck2, Wallet, MoveLeft } from "lucide-react";
import { loadWorkspace } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/workspace/status-badge";
import { money } from "@/lib/utils";
export default async function DashboardPage(){
 const data=await loadWorkspace();
 const available=data.units.filter(u=>u.status==="AVAILABLE").length;
 const metrics=[
  {label:"المشروعات",value:String(data.projects.length),icon:Building2},
  {label:"الوحدات المتاحة",value:String(available),icon:Blocks},
  {label:"العقود النشطة",value:String(data.contracts.filter(c=>c.status==="ACTIVE").length),icon:BadgeCheck},
  {label:"إجمالي المبيعات",value:money(data.totalSales),icon:Wallet},
 ];
 return <>
  <PageHeader eyebrow="نظرة عامة / OVERVIEW" title="لوحة التحكم" description={`مرحبًا بك في ${data.session.companyName} — نظرة مباشرة على بيانات شركتك.`}
    action={<Button asChild><Link href="/inventory">استعرض المخزون <ArrowUpLeft className="size-4"/></Link></Button>}/>
  <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
   {metrics.map(({label,value,icon:Icon})=><Card key={label} className="p-6"><div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-[#e7f3ef] text-[#188277]"><Icon className="size-5"/></div><p className="text-sm text-[#859994]">{label}</p><p className="mt-2 text-2xl font-black text-[#163d37]" dir="auto">{value}</p></Card>)}
  </section>
  <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
    <Card className="p-6">
     <div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-bold text-[#153d37]">مشروعات الشركة</h2><Link href="/projects" className="flex items-center gap-1 text-sm font-bold text-[#198277]">كل المشروعات <MoveLeft className="size-4"/></Link></div>
     <div className="space-y-3">{data.projects.slice(0,4).map(p=><Link href={`/inventory?project=${p.id}`} key={p.id} className="flex items-center justify-between rounded-xl border border-[#e9eeec] p-4 hover:bg-[#f7fbf9]"><div><p className="font-bold text-[#1c4640]">{p.name}</p><p className="mt-1 text-xs text-[#90a19d]">{p.location}</p></div><StatusBadge status={p.status}/></Link>)}{data.projects.length===0&&<p className="text-sm text-[#8c9e99]">لا توجد مشروعات بعد.</p>}</div>
    </Card>
    <Card className="p-6"><h2 className="mb-5 text-lg font-bold text-[#153d37]">نشاط التشغيل</h2>
      <div className="space-y-5">
       <div className="flex items-center gap-3"><div className="rounded-xl bg-[#e9f4f1] p-3 text-[#238c7d]"><CalendarCheck2 className="size-5"/></div><div><p className="text-sm font-semibold">الحجوزات</p><p className="text-xs text-[#869a95]">{data.bookings.length} حجز مسجل</p></div></div>
       <div className="flex items-center gap-3"><div className="rounded-xl bg-[#f2eee6] p-3 text-[#a4844e]"><Wallet className="size-5"/></div><div><p className="text-sm font-semibold">المقبوضات</p><p className="text-xs text-[#869a95]">{data.receipts.length} إيصال مسجل</p></div></div>
      </div>
      <p className="mt-8 rounded-xl bg-[#f1f8f6] p-4 text-xs leading-6 text-[#5a7d75]">الأرقام المعروضة من PostgreSQL مباشرة وليست إحصائيات وهمية.</p>
    </Card>
  </div>
 </>;
}
