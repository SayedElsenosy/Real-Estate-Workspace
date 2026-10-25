"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ShieldCheck, ArrowLeft, LoaderCircle } from "lucide-react";
import { DEMO_COMPANIES, DEMO_ROLES, type DemoRole } from "@/lib/demo/demo-config";
import { Button } from "@/components/ui/button";
const names:Record<DemoRole,string>={COMPANY_ADMIN:"مدير الشركة",SALES:"المبيعات",ACCOUNTANT:"المحاسبة"};
export function LoginForm(){
 const router=useRouter();
 const [tenantId,setTenantId]=useState<string>(DEMO_COMPANIES[0].id);
 const [role,setRole]=useState<DemoRole>("COMPANY_ADMIN");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");
  try {
   const result=await fetch("/api/dev/login",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({tenantId,role}),
   });
   const body=await result.json();
   if(!result.ok)throw new Error(body.error??"تعذر تسجيل الدخول");
   router.replace("/dashboard");router.refresh();
  }catch(error){setError(error instanceof Error?error.message:"تعذر تسجيل الدخول");}
  finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="space-y-6">
  <label className="block"><span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#31594f]"><Building2 className="size-4"/> الشركة التجريبية</span>
   <select aria-label="الشركة التجريبية" value={tenantId} onChange={e=>setTenantId(e.target.value)} className="h-12 w-full rounded-xl border border-[#d8e5df] bg-white px-4 text-sm text-[#245247]">
    {DEMO_COMPANIES.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
   </select></label>
  <label className="block"><span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#31594f]"><ShieldCheck className="size-4"/> الدور</span>
   <select aria-label="الدور" value={role} onChange={e=>setRole(e.target.value as DemoRole)} className="h-12 w-full rounded-xl border border-[#d8e5df] bg-white px-4 text-sm text-[#245247]">
    {DEMO_ROLES.map(r=><option key={r} value={r}>{names[r]}</option>)}
   </select></label>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  <Button type="submit" size="lg" className="w-full" disabled={busy}>
   {busy?<LoaderCircle className="size-5 animate-spin"/>:<ArrowLeft className="size-5"/>} دخول مساحة العمل
  </Button>
 </form>;
}
