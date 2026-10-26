"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table,TableHeader,TableHead,TableBody,TableRow,TableCell } from "@/components/ui/table";
type Employee={id:string;email:string;fullName:string;role:string;isActive:boolean};
type Invitation={id:string;email:string;role:string;expiresAt:string;usedAt:string|null;revokedAt:string|null};
const labels:Record<string,string>={COMPANY_ADMIN:"مدير شركة",SALES:"مبيعات",ACCOUNTANT:"محاسب"};
export function CompanyUserManager({employees,invitations}:{employees:Employee[];invitations:Invitation[]}){
 const router=useRouter();
 const [show,setShow]=useState(false),[email,setEmail]=useState(""),[role,setRole]=useState("SALES");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function invite(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/invitations",{method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({email,role})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"INVITATION_FAILED");
   setEmail("");setShow(false);setMessage("تم إرسال الدعوة بنجاح، وصلاحيتها 72 ساعة.");router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"تعذر إرسال الدعوة");}
  finally{setBusy(false);}
 }
 return <>
  <div className="mb-5 flex items-center justify-between gap-4">
   <strong>{employees.length} موظف مسجل</strong>
   <Button onClick={()=>setShow(v=>!v)}>{show?"إغلاق النموذج":"دعوة موظف جديد"}</Button>
  </div>
  {show&&<Card className="mb-6 p-5"><form onSubmit={invite} className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
    <Input type="email" required aria-label="البريد الإلكتروني للمدعو" placeholder="البريد الإلكتروني"
      value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/>
    <select aria-label="دور المستخدم" className="rounded-xl border bg-white p-2" value={role} onChange={e=>setRole(e.target.value)}>
      <option value="SALES">مبيعات</option><option value="ACCOUNTANT">محاسب</option><option value="COMPANY_ADMIN">مدير شركة</option>
    </select>
    <Button type="submit" disabled={busy}>{busy?"جارٍ الإرسال...":"إرسال الدعوة"}</Button>
   </form><p className="mt-3 text-xs text-slate-500">رابط فريد بصلاحية 72 ساعة، ولا تُخزن كلمة المرور إلا بعد قبول الدعوة.</p>
  </Card>}
  {message&&<p role="status" className="mb-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}
  <Card className="mb-6 overflow-x-auto"><h2 className="p-5 text-lg font-bold">الموظفون</h2>
   <Table><TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>البريد الإلكتروني</TableHead>
    <TableHead>الدور</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
    <TableBody>{employees.map(u=><TableRow key={u.id}>
      <TableCell>{u.fullName}</TableCell><TableCell dir="ltr">{u.email}</TableCell>
      <TableCell>{labels[u.role]??u.role}</TableCell><TableCell>{u.isActive?"نشط":"موقوف"}</TableCell>
    </TableRow>)}</TableBody></Table>
  </Card>
  <Card className="overflow-x-auto"><h2 className="p-5 text-lg font-bold">الدعوات الأخيرة</h2>
   <Table><TableHeader><TableRow><TableHead>البريد الإلكتروني</TableHead><TableHead>الدور</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
    <TableBody>{invitations.map(i=><TableRow key={i.id}>
      <TableCell dir="ltr">{i.email}</TableCell><TableCell>{labels[i.role]??i.role}</TableCell>
      <TableCell>{i.usedAt?"مقبولة":i.revokedAt?"ملغاة":new Date(i.expiresAt).getTime()<Date.now()?"منتهية":"قيد الانتظار"}</TableCell>
    </TableRow>)}</TableBody></Table>
    {!invitations.length&&<p className="p-5 text-sm text-slate-500">لا توجد دعوات.</p>}
  </Card>
 </>;
}
