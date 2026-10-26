"use client";
import {useLocale} from "next-intl";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {Card} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Table,TableHeader,TableHead,TableRow,TableBody,TableCell} from "@/components/ui/table";
type Tenant={tenant_id:string;name:string;slug:string;is_active:boolean;users_count:number;projects_count:number};
export function TenantManager({tenants}:{tenants:Tenant[]}){
 const ar=useLocale().startsWith("ar"),router=useRouter();
 const [name,setName]=useState(""),[adminName,setAdminName]=useState(""),
 [adminEmail,setAdminEmail]=useState(""),[adminPassword,setAdminPassword]=useState(""),
 [repeat,setRepeat]=useState(""),[target,setTarget]=useState<string|null>(null),
 [busy,setBusy]=useState(false),[working,setWorking]=useState(""),[message,setMessage]=useState("");
 const lbl=(arabic:string,english:string)=>ar?arabic:english;
 async function submit(action:"create"|"create_admin"|"status",payload:Record<string,unknown>){
  if(action!=="status"&&adminPassword!==repeat){
    setMessage(lbl("كلمتا المرور غير متطابقتين","Passwords do not match"));return;
  }
  setBusy(true);setMessage("");if(action==="status")setWorking(String(payload.id));
  try{
   const response=await fetch("/api/admin/tenants",{
     method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload}),
   });
   const result=await response.json();
   if(!response.ok)throw new Error(result.error??"OPERATION_FAILED");
   if(action!=="status"){
     setAdminName("");setAdminEmail("");setAdminPassword("");setRepeat("");
     if(action==="create")setName("");
     setTarget(null);
   }
   setMessage(action==="create"
     ?lbl("تم إنشاء الشركة ومديرها بنجاح. يمكنه تسجيل الدخول الآن.","Company and administrator created. The admin can now sign in.")
     :action==="create_admin"
     ?lbl("تم إنشاء حساب المدير بنجاح.","Company administrator account created.")
     :lbl("تم تحديث حالة الشركة.","Company status updated."));
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"OPERATION_FAILED");}
  finally{setBusy(false);setWorking("");}
 }
 const fields=<>
  <Input required aria-label={lbl("اسم مدير الشركة","Administrator full name")} placeholder={lbl("اسم المدير بالكامل","Administrator full name")}
    value={adminName} onChange={e=>setAdminName(e.target.value)} minLength={2} maxLength={200}/>
  <Input type="email" required aria-label={lbl("بريد المدير","Administrator email")} placeholder={lbl("بريد المدير","Administrator email")}
    value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} maxLength={254} dir="ltr"/>
  <Input type="password" required aria-label={lbl("كلمة المرور الأولية","Initial password")} autoComplete="new-password"
    placeholder={lbl("كلمة المرور (12 حرفًا على الأقل)","Password (at least 12 characters)")}
    minLength={12} value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} dir="ltr"/>
  <Input type="password" required aria-label={lbl("تأكيد كلمة المرور","Confirm password")} autoComplete="new-password"
    placeholder={lbl("تأكيد كلمة المرور","Confirm password")} minLength={12}
    value={repeat} onChange={e=>setRepeat(e.target.value)} dir="ltr"/>
 </>;
 return <>
 <Card className="mb-6 p-5">
  <h2 className="mb-2 text-xl font-bold">{lbl("إنشاء شركة ومديرها","Create company and administrator")}</h2>
  <p className="mb-5 text-sm text-slate-600">{lbl("سيتم إنشاء الشركة والحساب في نفس المعاملة دون إرسال دعوات.","Both the company and its administrator are created together, without invitations.")}</p>
  <form className="grid gap-3 md:grid-cols-2" onSubmit={e=>{e.preventDefault();void submit("create",{name,adminName,adminEmail,adminPassword});}}>
   <Input className="md:col-span-2" required aria-label={lbl("اسم الشركة","Company name")}
     placeholder={lbl("اسم الشركة","Company name")} minLength={2} maxLength={200}
     value={name} onChange={e=>setName(e.target.value)}/>
   {target===null&&fields}
   <div className="md:col-span-2"><Button type="submit" disabled={busy||target!==null}>
    {busy?lbl("جارٍ الحفظ...","Saving..."):lbl("إنشاء الشركة وحساب المدير","Create company and admin account")}
   </Button></div>
  </form>
 </Card>
 {message&&<p role="status" className="mb-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-800">{message}</p>}
 <Card className="overflow-x-auto">
  <h2 className="p-5 text-lg font-bold">{lbl("الشركات المسجلة","Registered companies")}</h2>
  <Table><TableHeader><TableRow>
   <TableHead>{lbl("الشركة","Company")}</TableHead><TableHead>Tenant ID</TableHead>
   <TableHead>{lbl("المستخدمون","Users")}</TableHead><TableHead>{lbl("المشروعات","Projects")}</TableHead>
   <TableHead>{lbl("الحالة","Status")}</TableHead><TableHead>{lbl("الإجراءات","Actions")}</TableHead>
  </TableRow></TableHeader><TableBody>{tenants.map(t=><TableRow key={t.tenant_id}>
   <TableCell><strong>{t.name}</strong><p className="text-xs text-slate-500" dir="ltr">{t.slug}</p></TableCell>
   <TableCell><span dir="ltr" className="select-all text-xs">{t.tenant_id}</span></TableCell>
   <TableCell>{t.users_count}</TableCell><TableCell>{t.projects_count}</TableCell>
   <TableCell>{t.is_active?lbl("نشطة","Active"):lbl("موقوفة","Suspended")}</TableCell>
   <TableCell><div className="flex flex-wrap gap-2">
     <Button size="sm" variant="outline" disabled={busy||!t.is_active}
       onClick={()=>{setTarget(t.tenant_id);setMessage("");setAdminName("");setAdminEmail("");setAdminPassword("");setRepeat("");}}>
       {lbl("إنشاء مدير","Add admin")}
     </Button>
     <Button size="sm" variant={t.is_active?"outline":"default"} disabled={busy}
       onClick={()=>void submit("status",{id:t.tenant_id,active:!t.is_active})}>
       {working===t.tenant_id?lbl("جارٍ الحفظ","Saving"):t.is_active?lbl("إيقاف","Suspend"):lbl("تفعيل","Activate")}
     </Button>
    </div></TableCell>
  </TableRow>)}</TableBody></Table>
  {!tenants.length&&<p className="p-6 text-slate-500">{lbl("لا توجد شركات بعد.","No companies yet.")}</p>}
 </Card>
 {target&&<Card className="mt-5 p-5">
  <h3 className="mb-4 text-lg font-bold">{lbl("إنشاء حساب مدير لشركة موجودة","Create an administrator for an existing company")}</h3>
  <p className="mb-3 text-sm text-slate-600">{tenants.find(t=>t.tenant_id===target)?.name}</p>
  <form className="grid gap-3 md:grid-cols-2" onSubmit={e=>{e.preventDefault();void submit("create_admin",{
    id:target,adminName,adminEmail,adminPassword,
  });}}>
   {fields}
   <div className="flex gap-2 md:col-span-2">
    <Button disabled={busy} type="submit">{lbl("إنشاء الحساب","Create account")}</Button>
    <Button type="button" variant="outline" onClick={()=>setTarget(null)}>{lbl("إلغاء","Cancel")}</Button>
   </div>
  </form>
 </Card>}
 <p className="mt-5 text-xs text-slate-500">{lbl("كلمات المرور تُرسل مشفرة إلى قاعدة البيانات ولا تظهر في قائمة الموظفين. سلّم بيانات الدخول للمدير بقناة آمنة.","Passwords are hashed before saving and never listed. Share initial credentials securely.")}</p>
 </>;
}
