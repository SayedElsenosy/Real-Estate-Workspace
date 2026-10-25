"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {CalendarCheck2,LoaderCircle,UserRound,Phone,UserPlus} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";
import {money} from "@/lib/utils";
export type UnitForBooking={id:string;unitNumber:string;price:string};
export function BookingDialog({unit,onClose,onSuccess,customers}:{unit:UnitForBooking|null;onClose:()=>void;onSuccess:(id:string)=>void;customers:{id:string;fullName:string;phonePrimary:string}[]}){
 const [mode,setMode]=useState<"existing"|"new">("new");
 const [query,setQuery]=useState("");
 const [customerId,setCustomerId]=useState("");
 const [name,setName]=useState("");
 const [phone,setPhone]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const router=useRouter();
 const found=customers.filter(c=>(c.fullName+" "+c.phonePrimary).toLowerCase().includes(query.trim().toLowerCase())).slice(0,30);
 function close(){if(!busy){setError("");setName("");setPhone("");setCustomerId("");onClose();}}
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!unit||busy)return;setError("");setBusy(true);
  try{
   const response=await fetch("/api/bookings",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({unit_id:unit.id,...(mode==="existing"?{customer_id:customerId}:{new_customer:{full_name:name.trim(),phone_primary:phone.trim()}})}),
   });
   const result=await response.json();
   if(!response.ok){setError(result.error||"تعذر إتمام الحجز");return;}
   if(result.booking?.status!=="CONFIRMED"){setError("نتيجة الحجز غير متوقعة");return;}
   onSuccess(unit.id);close();router.refresh();
  }catch{setError("تعذر الاتصال بخدمة الحجز");}finally{setBusy(false);}
 }
 return <Dialog open={unit!==null} onOpenChange={open=>{if(!open)close();}}><DialogContent><DialogHeader><DialogTitle>حجز الوحدة {unit?.unitNumber}</DialogTitle><DialogDescription>اربط الحجز بسجل العميل الحالي أو أنشئ ملف عميل جديد.</DialogDescription></DialogHeader>
 <p className="mb-4 rounded-xl bg-[#f5faf8] p-3 text-sm">السعر: <strong dir="ltr">{unit?money(unit.price):""}</strong></p>
 <div className="mb-4 flex gap-2"><Button type="button" size="sm" variant={mode==="existing"?"default":"outline"} onClick={()=>setMode("existing")}><UserRound className="size-4"/> عميل موجود</Button><Button type="button" size="sm" variant={mode==="new"?"default":"outline"} onClick={()=>setMode("new")}><UserPlus className="size-4"/> إضافة عميل جديد</Button></div>
 <form onSubmit={submit} className="space-y-4">
 {mode==="existing"?<div className="space-y-2"><label className="block text-sm font-semibold">بحث عن العميل<Input aria-label="بحث عن عميل للحجز" value={query} onChange={e=>setQuery(e.target.value)} placeholder="اسم أو رقم هاتف"/></label>
 <label className="block text-sm font-semibold">اختيار العميل<select aria-label="اختيار العميل" required value={customerId} onChange={e=>setCustomerId(e.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-white px-3"><option value="">اختر العميل</option>{found.map(c=><option key={c.id} value={c.id}>{c.fullName} — {c.phonePrimary}</option>)}</select></label></div>
 :<><label className="block text-sm font-semibold">اسم العميل<Input aria-label="اسم العميل" required minLength={2} maxLength={200} value={name} onChange={e=>setName(e.target.value)} placeholder="الاسم بالكامل"/></label><label className="block text-sm font-semibold">رقم الهاتف<Input aria-label="رقم الهاتف" dir="ltr" required type="tel" minLength={6} maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="010xxxxxxxx"/></label></>}
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
 <div className="flex gap-2"><Button disabled={busy||mode==="existing"&&!customerId} type="submit" className="flex-1">{busy?<LoaderCircle className="size-4 animate-spin"/>:<CalendarCheck2 className="size-4"/>} تأكيد الحجز</Button><Button type="button" variant="outline" onClick={close} disabled={busy}>إلغاء</Button></div>
 </form></DialogContent></Dialog>;
}
