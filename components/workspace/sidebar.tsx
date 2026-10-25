"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Building2, Blocks, CalendarCheck2, FileText, Wallet, LogOut, Layers3, ChevronLeft, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
const links=[
 {href:"/dashboard",title:"لوحة التحكم",icon:LayoutDashboard},
 {href:"/projects",title:"المشروعات",icon:Building2},
 {href:"/inventory",title:"المخزون",icon:Blocks},
 {href:"/bookings",title:"الحجوزات",icon:CalendarCheck2},
 {href:"/contracts",title:"العقود",icon:FileText},
 {href:"/treasury",title:"الخزينة",icon:Wallet},
];
const roles:Record<string,string>={COMPANY_ADMIN:"مدير الشركة",SALES:"المبيعات",ACCOUNTANT:"المحاسبة"};
export function Sidebar({companyName,role}:{companyName:string;role:string}) {
 const pathname=usePathname();
 const router=useRouter();
 async function logout(){
   await fetch("/api/dev/logout",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin"});
   router.replace("/login");router.refresh();
 }
 return <aside className="flex w-full flex-col border-b border-[#e4eae8] bg-white md:sticky md:top-0 md:h-screen md:w-[255px] md:shrink-0 md:border-b-0 md:border-l">
   <div className="flex items-center gap-3 px-6 py-6">
     <div className="flex size-11 items-center justify-center rounded-2xl bg-[#19776f] text-white shadow-lg shadow-teal-800/10"><Layers3 className="size-6"/></div>
     <div><span className="block text-[17px] font-black tracking-wide text-[#173b37]">[Project Name]</span><span className="text-xs text-[#98aba7]">Developer Workspace</span></div>
   </div>
   <div className="mx-4 mb-5 rounded-2xl border border-[#dfeae7] bg-[#f5faf8] p-4">
     <div className="mb-2 flex items-center gap-2 text-xs text-[#6f9790]"><ShieldCheck className="size-4"/> مساحة الشركة</div>
     <p className="truncate text-sm font-bold text-[#18483f]">{companyName}</p>
     <p className="mt-1 text-xs text-[#748d88]">{roles[role]??role} · تجربة محلية</p>
   </div>
   <nav aria-label="التنقل الرئيسي" className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-1 md:flex-col md:overflow-visible">
     {links.map(({href,title,icon:Icon})=>{
       const selected=pathname===href;
       return <Link key={href} href={href} className={cn("flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors md:w-full",selected?"bg-[#e7f3ef] text-[#13796d]":"text-[#667d78] hover:bg-[#f2f7f5] hover:text-[#163d37]")}>
         <Icon className="size-[19px]"/><span>{title}</span>{selected&&<ChevronLeft className="mr-auto hidden size-4 md:block"/>}
       </Link>;
     })}
   </nav>
   <div className="hidden border-t border-[#edf1ef] px-4 py-4 md:block">
     <Button variant="ghost" onClick={logout} className="w-full justify-start gap-3 text-[#69817b]"><LogOut className="size-4"/> تبديل الحساب</Button>
   </div>
   <button onClick={logout} className="mx-4 mb-3 flex items-center gap-2 text-xs text-[#69817b] md:hidden"><LogOut className="size-4"/> تسجيل الخروج</button>
 </aside>;
}
