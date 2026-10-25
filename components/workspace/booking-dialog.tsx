"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, LoaderCircle, Phone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { money } from "@/lib/utils";

export type UnitForBooking={id:string;unitNumber:string;price:string};
export function BookingDialog({unit,onClose,onSuccess}:{
 unit:UnitForBooking|null;onClose:()=>void;onSuccess:(unitId:string)=>void;
}){
 const [customerName,setCustomerName]=useState("");
 const [customerPhone,setCustomerPhone]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const router=useRouter();
 function close(){if(!busy){setCustomerName("");setCustomerPhone("");setError("");onClose();}}
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!unit||busy)return;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/bookings",{
     method:"POST",
     credentials:"same-origin",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({unit_id:unit.id,customer_name:customerName.trim(),customer_phone:customerPhone.trim()}),
   });
   const payload=await response.json();
   if(!response.ok){setError(payload.error||"تعذر إتمام الحجز");return;}
   if(payload.booking?.status!=="CONFIRMED"){setError("نتيجة الحجز غير متوقعة");return;}
   onSuccess(unit.id);setCustomerName("");setCustomerPhone("");onClose();
   router.refresh();
  }catch{setError("تعذر الاتصال بخدمة الحجز. تحقق من اتصالك.");}
  finally{setBusy(false);}
 }
 return <Dialog open={unit!==null} onOpenChange={open=>{if(!open)close();}}>
  <DialogContent>
    <DialogHeader>
      <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-[#e9f5f1] text-[#1c887b]"><CalendarCheck2 className="size-6"/></div>
      <DialogTitle>حجز الوحدة {unit?.unitNumber}</DialogTitle>
      <DialogDescription>أدخل بيانات العميل لبدء الحجز. سيُحجز العقار فور تأكيد العملية في قاعدة البيانات.</DialogDescription>
    </DialogHeader>
    <div className="mb-5 flex items-center justify-between rounded-xl bg-[#f5faf8] px-4 py-3 text-sm"><span className="text-[#80948e]">سعر الوحدة</span><strong dir="ltr" className="text-[#19776f]">{unit?money(unit.price):""}</strong></div>
    <form onSubmit={submit} className="space-y-4">
     <label className="block space-y-2"><span className="flex items-center gap-2 text-sm font-semibold text-[#31534d]"><UserRound className="size-4"/> اسم العميل</span>
       <Input aria-label="اسم العميل" autoComplete="name" required minLength={2} maxLength={200} value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="الاسم بالكامل"/></label>
     <label className="block space-y-2"><span className="flex items-center gap-2 text-sm font-semibold text-[#31534d]"><Phone className="size-4"/> رقم الهاتف</span>
       <Input aria-label="رقم الهاتف" type="tel" dir="ltr" autoComplete="tel" required minLength={6} maxLength={30} value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="010xxxxxxxx"/></label>
     {error&&<p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
     <div className="flex gap-3 pt-3"><Button disabled={busy} type="submit" className="flex-1">{busy?<LoaderCircle className="size-4 animate-spin"/>:<CalendarCheck2 className="size-4"/>} تأكيد الحجز</Button><Button type="button" variant="outline" disabled={busy} onClick={close}>إلغاء</Button></div>
    </form>
  </DialogContent>
 </Dialog>;
}
