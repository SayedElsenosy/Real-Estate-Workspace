import {useTranslations} from "next-intl";
"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
type Cheque={id:string;amount:string;referenceNumber:string|null;customer:string;receiptDate:string};
export function PendingCheques({initial}:{initial:Cheque[]}){
 const [items,setItems]=useState(initial),[reasonFor,setReasonFor]=useState<string|null>(null),[reason,setReason]=useState(""),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");
 const router=useRouter();
 const t=useTranslations("ui");
 async function process(id:string,status:"CLEARED"|"BOUNCED"){
  setBusy(id);setError("");
  try{
   const response=await fetch("/api/receipts/"+id+"/process-cheque",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({new_status:status,...(status==="BOUNCED"?{reason}: {})})});
   const body=await response.json();if(!response.ok)throw Error(body.error||t("chequeError"));
   setItems(current=>current.filter(i=>i.id!==id));setReasonFor(null);setReason("");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:t("unexpectedError"));}finally{setBusy(null);}
 }
 return <section aria-label={t("pendingCheques")} className="mt-6 rounded-2xl border bg-white p-6">
  <h2 className="mb-4 text-xl font-bold">{t("pendingWithCount",{count:items.length})}</h2>
  {error&&<p role="alert" className="mb-3 text-red-700">{error}</p>}
  {items.length===0?<p className="text-slate-500">{t("noPending")}</p>:<div className="space-y-4">{items.map(c=><div key={c.id} data-testid={"cheque-"+c.id} className="rounded-xl border p-4">
   <p className="font-semibold">{c.customer} — {c.amount} ج.م</p><p className="text-sm text-slate-500">{t("chequeReference")}: {c.referenceNumber||"—"} · {c.receiptDate}</p>
   <div className="mt-3 flex gap-2"><Button disabled={busy!==null} size="sm" onClick={()=>process(c.id,"CLEARED")}>{t("settle")}</Button><Button disabled={busy!==null} size="sm" variant="destructive" onClick={()=>setReasonFor(c.id)}>{t("bounce")}</Button></div>
   <Dialog open={reasonFor===c.id} onOpenChange={open=>{if(!open&&!busy){setReasonFor(null);setReason("");}}}>
    <DialogContent><DialogHeader><DialogTitle>{t("bounceTitle")}</DialogTitle><DialogDescription>{t("bounceExplain")}</DialogDescription></DialogHeader>
    <form className="space-y-3" onSubmit={e=>{e.preventDefault();process(c.id,"BOUNCED");}}>
     <label className="block text-sm">{t("bounceReason")}<Input required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} aria-label={t("bounceReason")}/></label>
     <div className="flex gap-2"><Button disabled={busy!==null||!reason.trim()} type="submit">{t("confirmBounce")}</Button><Button type="button" variant="outline" onClick={()=>setReasonFor(null)}>{t("goBack")}</Button></div>
    </form></DialogContent>
   </Dialog>
  </div>)}</div>}
 </section>;
}
