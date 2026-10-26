"use client";
import {useEffect} from "react";
import {AlertTriangle} from "lucide-react";
import {Button} from "@/components/ui/button";
export default function WorkspaceError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{console.error("Workspace rendering failed",error.digest||error.name);},[error]);
 return <section role="alert" className="mx-auto my-12 max-w-lg rounded-2xl border border-red-100 bg-white p-9 text-center shadow-sm"><AlertTriangle className="mx-auto mb-4 size-10 text-amber-600"/><h2 className="text-xl font-bold">تعذر تحميل الصفحة</h2><p className="my-4 text-slate-600">حدثت مشكلة أثناء عرض الصفحة. قد تكون بعض العمليات اكتملت بالفعل؛ راجع البيانات قبل إعادة الإرسال ثم جرّب تحميل الصفحة من جديد.</p><Button onClick={reset}>إعادة المحاولة</Button></section>;
}
