"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function InviteAcceptForm({token}:{token:string}){
 const [fullName,setFullName]=useState(""),[password,setPassword]=useState("");
 const [confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
 const [complete,setComplete]=useState(false);
 async function accept(e:React.FormEvent){
  e.preventDefault();
  if(password!==confirm){setStatus("كلمتا المرور غير متطابقتين.");return;}
  setBusy(true);setStatus("");
  try{
   const response=await fetch("/api/invitations/accept",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token,fullName,password}),
   });
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"تعذر قبول الدعوة");
   setComplete(true);setPassword("");setConfirm("");setStatus("تم إنشاء حسابك. سجّل الدخول بالبريد وكلمة المرور.");
  }catch(e){setStatus(e instanceof Error?e.message:"تعذر إكمال الدعوة");}
  finally{setBusy(false);}
 }
 if(complete)return <div><p role="status" className="mb-5 text-teal-800">{status}</p>
  <Link href="/login" className="inline-flex rounded-xl bg-[#19776f] px-5 py-3 font-bold text-white">انتقل لتسجيل الدخول</Link>
 </div>;
 return <form onSubmit={accept} className="space-y-4">
   <label className="block text-sm font-semibold">الاسم بالكامل
    <Input required minLength={2} maxLength={200} autoComplete="name" value={fullName}
      onChange={e=>setFullName(e.target.value)} className="mt-2"/>
   </label>
   <label className="block text-sm font-semibold">كلمة المرور
    <Input required type="password" minLength={12} autoComplete="new-password"
      value={password} onChange={e=>setPassword(e.target.value)} className="mt-2"/>
   </label>
   <label className="block text-sm font-semibold">تأكيد كلمة المرور
    <Input required type="password" minLength={12} autoComplete="new-password"
      value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-2"/>
   </label>
   {status&&<p role="alert" className="text-sm text-red-700">{status}</p>}
   <Button type="submit" disabled={busy}>{busy?"جارٍ تفعيل الحساب...":"تفعيل الحساب"}</Button>
 </form>;
}
