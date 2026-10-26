"use client";
import {useTranslations} from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table,TableHeader,TableHead,TableRow,TableBody,TableCell } from "@/components/ui/table";
type Tenant={tenant_id:string;name:string;slug:string;is_active:boolean;users_count:number;projects_count:number};
export function TenantManager({tenants}:{tenants:Tenant[]}){
 const router=useRouter();
 const translate=useTranslations("tenants");
 const [name,setName]=useState(""),[busy,setBusy]=useState(false),[working,setWorking]=useState(""),[message,setMessage]=useState("");
 async function submit(action:"create"|"status",payload:Record<string,unknown>){
  setBusy(true);setMessage("");if(action==="status")setWorking(String(payload.id));
  try {
   const res=await fetch("/api/admin/tenants",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});
   const body=await res.json();
   if(!res.ok)throw new Error(body.error||"OPERATION_FAILED");
   if(action==="create")setName("");
   setMessage(action==="create"?translate("created"):translate("updated"));
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"تعذر تنفيذ العملية");}
  finally{setBusy(false);setWorking("");}
 }
 return <>
  <Card className="mb-6 p-5"><h2 className="mb-4 text-xl font-bold">{translate("new")}</h2>
   <form className="flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();void submit("create",{name});}}>
    <Input className="min-w-52 flex-1" placeholder={translate("name")} aria-label={translate("name")}
      required minLength={2} maxLength={200} value={name} onChange={e=>setName(e.target.value)}/>
    <Button disabled={busy} type="submit">{translate("create")}</Button>
   </form>
   <p className="mt-2 text-xs text-slate-500">{translate("tip")}</p>
   {message&&<p role="status" className="mt-3 text-sm text-teal-700">{message}</p>}
  </Card>
  <Card className="overflow-x-auto">
   <Table><TableHeader><TableRow><TableHead>{translate("company")}</TableHead><TableHead>Tenant ID</TableHead>
    <TableHead>{translate("users")}</TableHead><TableHead>{translate("projects")}</TableHead><TableHead>{translate("status")}</TableHead><TableHead>{translate("action")}</TableHead>
   </TableRow></TableHeader><TableBody>{tenants.map(t=><TableRow key={t.tenant_id}>
    <TableCell><strong>{t.name}</strong><p className="text-xs text-slate-500" dir="ltr">{t.slug}</p></TableCell>
    <TableCell className="text-xs"><span dir="ltr" className="select-all text-[11px]">{t.tenant_id}</span></TableCell>
    <TableCell>{t.users_count}</TableCell><TableCell>{t.projects_count}</TableCell>
    <TableCell>{t.is_active?translate("active"):translate("suspended")}</TableCell>
    <TableCell><Button size="sm" variant={t.is_active?"outline":"default"}
      disabled={busy} onClick={()=>void submit("status",{id:t.tenant_id,active:!t.is_active})}>
      {working===t.tenant_id?translate("saving"):t.is_active?translate("suspend"):translate("activate")}</Button></TableCell>
   </TableRow>)}</TableBody></Table>
   {tenants.length===0&&<p className="p-6 text-sm text-slate-500">{translate("empty")}</p>}
  </Card>
 </>;
}
