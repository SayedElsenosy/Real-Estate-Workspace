"use client";
import {useState} from "react";import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";import {Input} from "@/components/ui/input";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
export function ContractGeneration({bookingId,totalAmount}:{bookingId:string;totalAmount:string}){
 const [open,setOpen]=useState(false),[down,setDown]=useState("20"),[count,setCount]=useState("6"),[interval,setInterval]=useState("3"),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const router=useRouter();
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");
 try{const res=await fetch("/api/contracts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({booking_id:bookingId,total_amount:totalAmount,payment_plan:{down_payment_percent:down,installment_count:parseInt(count,10),interval_months:parseInt(interval,10)}})});
 const data=await res.json();if(!res.ok){setError(data.error||"تعذر إنشاء العقد");return;}setOpen(false);router.refresh();router.push("/contracts");}
 catch{setError("تعذر الاتصال بالخادم");}finally{setBusy(false);}}
 return <><Button size="sm" onClick={()=>setOpen(true)}>توليد عقد</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>توليد عقد</DialogTitle><DialogDescription>إنشاء العقد وجدول الأقساط في معاملة واحدة.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><label>نسبة المقدم %<Input value={down} onChange={e=>setDown(e.target.value)} required type="number" min="0" max="100" step="0.01"/></label><label>عدد الأقساط<Input type="number" min="1" max="120" required value={count} onChange={e=>setCount(e.target.value)}/></label><label>الفاصل بالشهور<Input type="number" min="1" max="120" required value={interval} onChange={e=>setInterval(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<Button type="submit" disabled={busy}>{busy?"جارٍ الإنشاء...":"إنشاء العقد"}</Button></form></DialogContent></Dialog></>;
}
