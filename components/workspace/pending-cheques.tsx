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
 async function process(id:string,status:"CLEARED"|"BOUNCED"){
  setBusy(id);setError("");
  try{
   const response=await fetch("/api/receipts/"+id+"/process-cheque",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({new_status:status,...(status==="BOUNCED"?{reason}: {})})});
   const body=await response.json();if(!response.ok)throw Error(body.error||"تعذر تحديث الشيك");
   setItems(current=>current.filter(i=>i.id!==id));setReasonFor(null);setReason("");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"خطأ غير متوقع");}finally{setBusy(null);}
 }
 return <section aria-label="الشيكات تحت التحصيل" className="mt-6 rounded-2xl border bg-white p-6">
  <h2 className="mb-4 text-xl font-bold">الشيكات تحت التحصيل ({items.length})</h2>
  {error&&<p role="alert" className="mb-3 text-red-700">{error}</p>}
  {items.length===0?<p className="text-slate-500">لا توجد شيكات معلقة.</p>:<div className="space-y-4">{items.map(c=><div key={c.id} data-testid={"cheque-"+c.id} className="rounded-xl border p-4">
   <p className="font-semibold">{c.customer} — {c.amount} ج.م</p><p className="text-sm text-slate-500">مرجع: {c.referenceNumber||"—"} · {c.receiptDate}</p>
   <div className="mt-3 flex gap-2"><Button disabled={busy!==null} size="sm" onClick={()=>process(c.id,"CLEARED")}>تحصيل</Button><Button disabled={busy!==null} size="sm" variant="destructive" onClick={()=>setReasonFor(c.id)}>ارتداد</Button></div>
   <Dialog open={reasonFor===c.id} onOpenChange={open=>{if(!open&&!busy){setReasonFor(null);setReason("");}}}>
    <DialogContent><DialogHeader><DialogTitle>ارتداد الشيك</DialogTitle><DialogDescription>سيرجع القسط المرتبط إلى متأخر وسيتم استبعاد قيمة الشيك من المقبوضات.</DialogDescription></DialogHeader>
    <form className="space-y-3" onSubmit={e=>{e.preventDefault();process(c.id,"BOUNCED");}}>
     <label className="block text-sm">سبب الارتداد<Input required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} aria-label="سبب الارتداد"/></label>
     <div className="flex gap-2"><Button disabled={busy!==null||!reason.trim()} type="submit">تأكيد الارتداد</Button><Button type="button" variant="outline" onClick={()=>setReasonFor(null)}>إلغاء</Button></div>
    </form></DialogContent>
   </Dialog>
  </div>)}</div>}
 </section>;
}
