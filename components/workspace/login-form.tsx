"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
export function LoginForm(){
 const router=useRouter();
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");
  const form=new FormData(event.currentTarget);
  try {
   const result=await signIn("credentials",{email:form.get("email"),password:form.get("password"),redirect:false});
   if (!result || result.error || !result.ok) {setError("تعذر الدخول. راجع البريد وكلمة المرور أو حاول لاحقًا.");return;}
   router.replace("/dashboard");router.refresh();
  } catch {setError("تعذر الاتصال. حاول مرة أخرى.");}
  finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="space-y-6">
  <label className="block"><span className="mb-2 block text-sm font-semibold text-[#31594f]">البريد الإلكتروني</span>
   <input name="email" type="email" autoComplete="username" required maxLength={254} dir="ltr" disabled={busy}
    className="h-12 w-full rounded-xl border border-[#d8e5df] bg-white px-4 text-sm text-[#245247] focus:outline-2 focus:outline-teal-700"/></label>
  <label className="block"><span className="mb-2 block text-sm font-semibold text-[#31594f]">كلمة المرور</span>
   <input name="password" type="password" autoComplete="current-password" required disabled={busy}
    className="h-12 w-full rounded-xl border border-[#d8e5df] bg-white px-4 text-sm text-[#245247] focus:outline-2 focus:outline-teal-700"/></label>
  {error&&<p role="alert" aria-live="polite" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  <Button type="submit" size="lg" className="w-full" disabled={busy}>
   {busy?<LoaderCircle className="size-5 animate-spin"/>:<ArrowLeft className="size-5"/>} دخول مساحة العمل
  </Button>
 </form>;
}
