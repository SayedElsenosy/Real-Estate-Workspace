"use client";
import {useTranslations} from "next-intl";
import {businessDate} from "@/lib/utils/date";
import {useState} from "react";import {useRouter} from "next/navigation";import {Button} from "@/components/ui/button";import {Input} from "@/components/ui/input";import {Dialog,DialogContent,DialogHeader,DialogTitle} from "@/components/ui/dialog";
export function RecordPaymentDialog({contractId,installmentId,amount,onPaid}:{contractId:string;installmentId:string;amount:string;onPaid?:()=>void}){
 const t=useTranslations("payments"),errors=useTranslations("errors");
 const [open,setOpen]=useState(false),[method,setMethod]=useState("CASH"),[reference,setReference]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");const router=useRouter();
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");
 try{const date=businessDate(new Date());const res=await fetch("/api/receipts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contract_id:contractId,installment_id:installmentId,amount,method,reference_number:method==="CASH"?null:reference.trim(),receipt_date:date})});const data=await res.json();if(!res.ok){setError(data.error||t("failed"));return;}onPaid?.();setOpen(false);router.refresh();}
 catch{setError(errors("network"));}finally{setBusy(false);}}
 return <><Button size="sm" onClick={()=>setOpen(true)}>{t("record")}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{t("title")}</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-4"><p>{t("fullAmount",{amount})}</p><label>{t("method")}<select aria-label={t("method")} className="block w-full border p-3" value={method} onChange={e=>setMethod(e.target.value)}><option value="CASH">{t("cash")}</option><option value="BANK_TRANSFER">{t("bank")}</option><option value="CHEQUE">{t("cheque")}</option></select></label>{method!=="CASH"&&<label>{t("reference")}<Input required maxLength={150} value={reference} onChange={e=>setReference(e.target.value)}/></label>}{error&&<p role="alert">{error}</p>}<Button type="submit" disabled={busy}>{busy?t("saving"):t("confirm")}</Button></form></DialogContent></Dialog></>;
}
