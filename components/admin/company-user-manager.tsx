"use client";
import {useLocale} from "next-intl";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {Card} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Table,TableHeader,TableHead,TableBody,TableRow,TableCell} from "@/components/ui/table";
type Employee={id:string;email:string;fullName:string;role:string;isActive:boolean};
export function CompanyUserManager({employees}:{employees:Employee[]}){
 const ar=useLocale().startsWith("ar"),router=useRouter();
 const lbl=(a:string,en:string)=>ar?a:en;
 const roles:Record<string,string>={COMPANY_ADMIN:lbl("مدير الشركة","Company Admin"),
   SALES:lbl("المبيعات","Sales"),ACCOUNTANT:lbl("المحاسبة","Accountant")};
 const [show,setShow]=useState(false),[fullName,setName]=useState(""),[email,setEmail]=useState(""),
 [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),
 [role,setRole]=useState("SALES"),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function create(e:React.FormEvent){
  e.preventDefault();if(password!==confirm){setMessage(lbl("تأكيد كلمة المرور غير مطابق","Password confirmation does not match"));return;}
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/company/users",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({fullName,email,password,role}),
   });
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"ACCOUNT_CREATION_FAILED");
   setName("");setEmail("");setPassword("");setConfirm("");setRole("SALES");setShow(false);
   setMessage(lbl("تم إنشاء الحساب بنجاح. الموظف يقدر يسجل دخول بالبريد وكلمة المرور الأولية.","Account created; the employee can sign in with the provided credentials."));
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"ACCOUNT_CREATION_FAILED");}
  finally{setBusy(false);}
 }
 return <>
  <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
   <strong>{employees.length} {lbl("موظف مسجل","registered employees")}</strong>
   <Button onClick={()=>setShow(v=>!v)}>{show?lbl("إغلاق","Close"):lbl("إنشاء حساب موظف","Create employee account")}</Button>
  </div>
  {show&&<Card className="mb-6 p-5"><h2 className="mb-4 text-lg font-bold">{lbl("بيانات الحساب الجديد","New account details")}</h2>
   <form onSubmit={create} className="grid gap-3 md:grid-cols-2">
    <Input required minLength={2} maxLength={200} aria-label={lbl("الاسم بالكامل","Full name")}
      placeholder={lbl("الاسم بالكامل","Full name")} value={fullName} onChange={e=>setName(e.target.value)}/>
    <Input required type="email" maxLength={254} dir="ltr" aria-label={lbl("البريد الإلكتروني","Email")}
      placeholder={lbl("البريد الإلكتروني","Email")} value={email} onChange={e=>setEmail(e.target.value)}/>
    <select aria-label={lbl("دور المستخدم","Role")} className="rounded-xl border bg-white p-2" value={role} onChange={e=>setRole(e.target.value)}>
     <option value="SALES">{roles.SALES}</option>
     <option value="ACCOUNTANT">{roles.ACCOUNTANT}</option>
     <option value="COMPANY_ADMIN">{roles.COMPANY_ADMIN}</option>
    </select>
    <Input required type="password" minLength={12} autoComplete="new-password" dir="ltr"
      aria-label={lbl("كلمة المرور الأولية","Initial password")}
      placeholder={lbl("كلمة المرور (12 حرفًا على الأقل)","Password (12+ characters)")}
      value={password} onChange={e=>setPassword(e.target.value)}/>
    <Input required type="password" minLength={12} autoComplete="new-password" dir="ltr"
      aria-label={lbl("تأكيد كلمة المرور","Confirm password")}
      placeholder={lbl("تأكيد كلمة المرور","Confirm password")}
      value={confirm} onChange={e=>setConfirm(e.target.value)}/>
    <div className="flex items-center gap-2">
      <Button type="submit" disabled={busy}>{busy?lbl("جارٍ الإنشاء...","Creating..."):lbl("إنشاء الحساب","Create account")}</Button>
      <Button type="button" variant="outline" onClick={()=>setShow(false)}>{lbl("إلغاء","Cancel")}</Button>
    </div>
   </form>
   <p className="mt-3 text-xs text-slate-500">{lbl("لا توجد دعوات. بعد الإنشاء سلّم بيانات الدخول للموظف بشكل آمن.","No invitations. Share the initial credentials securely after creation.")}</p>
  </Card>}
  {message&&<p role="status" className="mb-4 rounded-xl bg-teal-50 p-4 text-sm text-teal-800">{message}</p>}
  <Card className="overflow-x-auto">
    <h2 className="p-5 text-lg font-bold">{lbl("حسابات الموظفين","Employee accounts")}</h2>
    <Table><TableHeader><TableRow>
      <TableHead>{lbl("الاسم","Name")}</TableHead><TableHead>{lbl("البريد الإلكتروني","Email")}</TableHead>
      <TableHead>{lbl("الدور","Role")}</TableHead><TableHead>{lbl("الحالة","Status")}</TableHead>
    </TableRow></TableHeader><TableBody>{employees.map(u=><TableRow key={u.id}>
      <TableCell>{u.fullName}</TableCell><TableCell dir="ltr">{u.email}</TableCell>
      <TableCell>{roles[u.role]??u.role}</TableCell>
      <TableCell>{u.isActive?lbl("نشط","Active"):lbl("موقوف","Suspended")}</TableCell>
    </TableRow>)}</TableBody></Table>
    {!employees.length&&<p className="p-5 text-sm text-slate-500">{lbl("لا توجد حسابات بعد.","No accounts yet.")}</p>}
  </Card>
 </>;
}
