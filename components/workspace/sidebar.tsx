"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Blocks, CalendarCheck2, FileText, Wallet, LogOut, Layers3, ChevronLeft, ShieldCheck, UsersRound, Settings2, ChartNoAxesCombined } from "lucide-react";
import { cn } from "@/lib/utils";
import {useTranslations} from "next-intl";
import { Button } from "@/components/ui/button";
const links=[
 {href:"/dashboard",title:"dashboard",icon:LayoutDashboard},
 {href:"/projects",title:"projects",icon:Building2},
 {href:"/inventory",title:"inventory",icon:Blocks},
 {href:"/bookings",title:"bookings",icon:CalendarCheck2},
 {href:"/customers",title:"customers",icon:UsersRound},
 {href:"/contracts",title:"contracts",icon:FileText},
 {href:"/treasury",title:"treasury",icon:Wallet},
 {href:"/reports/aging",title:"aging",icon:ChartNoAxesCombined},
 {href:"/settings/contracts",title:"templates",icon:Settings2},
 {href:"/settings/users",title:"users",icon:UsersRound},
 {href:"/settings/audit",title:"audit",icon:ShieldCheck},
];
const roles:Record<string,string>={PLATFORM_OWNER:"مالك المنصة",COMPANY_ADMIN:"مدير الشركة",SALES:"المبيعات",ACCOUNTANT:"المحاسبة"};
export function Sidebar({companyName,role}:{companyName:string;role:string}) {
 const pathname=usePathname();
 const t=useTranslations("nav"),common=useTranslations("common"),roles=useTranslations("roles");
 async function logout(){
   await signOut({redirectTo:"/login"});
 }
 return <aside className="flex w-full flex-col border-b border-[#e4eae8] bg-white md:sticky md:top-0 md:h-screen md:w-[255px] md:shrink-0 md:border-b-0 md:border-l">
   <div className="flex items-center gap-3 px-6 py-6">
     <div className="flex size-11 items-center justify-center rounded-2xl bg-[#19776f] text-white shadow-lg shadow-teal-800/10"><Layers3 className="size-6"/></div>
     <div><span className="block text-[17px] font-black tracking-wide text-[#173b37]">BUNYRA</span><span className="text-xs text-[#98aba7]">ERP & CRM</span></div>
   </div>
   <div className="mx-4 mb-5 rounded-2xl border border-[#dfeae7] bg-[#f5faf8] p-4">
     <div className="mb-2 flex items-center gap-2 text-xs text-[#6f9790]"><ShieldCheck className="size-4"/> {common("company")}</div>
     <p className="truncate text-sm font-bold text-[#18483f]">{companyName}</p>
     <p className="mt-1 text-xs text-[#748d88]">{["PLATFORM_OWNER","COMPANY_ADMIN","SALES","ACCOUNTANT"].includes(role)?roles(role as "PLATFORM_OWNER"|"COMPANY_ADMIN"|"SALES"|"ACCOUNTANT"):role}</p>
   </div>
   <nav aria-label="التنقل الرئيسي" className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-1 md:flex-col md:overflow-visible">
     {(role==="PLATFORM_OWNER"?[{href:"/admin/tenants",title:"tenants",icon:Building2}]:links.filter(link=>!["/settings/users","/settings/audit"].includes(link.href) || role==="COMPANY_ADMIN")).map(({href,title,icon:Icon})=>{
       const selected=pathname===href;
       return <Link key={href} href={href} className={cn("flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors md:w-full",selected?"bg-[#e7f3ef] text-[#13796d]":"text-[#667d78] hover:bg-[#f2f7f5] hover:text-[#163d37]")}>
         <Icon className="size-[19px]"/><span>{t(title as "dashboard"|"projects"|"inventory"|"bookings"|"customers"|"contracts"|"treasury"|"aging"|"templates"|"users"|"audit"|"tenants")}</span>{selected&&<ChevronLeft className="mr-auto hidden size-4 md:block"/>}
       </Link>;
     })}
   </nav>
   <div className="hidden border-t border-[#edf1ef] px-4 py-4 md:block">
     <Button variant="ghost" onClick={logout} className="w-full justify-start gap-3 text-[#69817b]"><LogOut className="size-4"/> {common("logout")}</Button>
   </div>
   <button onClick={logout} className="mx-4 mb-3 flex items-center gap-2 text-xs text-[#69817b] md:hidden"><LogOut className="size-4"/> {common("logout")}</button>
 </aside>;
}
