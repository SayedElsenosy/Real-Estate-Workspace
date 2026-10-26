import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getAuthDatabase } from "@/lib/db/auth-client";
import { InviteAcceptForm } from "@/components/admin/invite-accept-form";
export const dynamic="force-dynamic";
export default async function InvitePage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 let invited: {email:string;company_name:string;role:string;expires_at:Date}|undefined;
 if(/^[a-f0-9]{64}$/.test(token)){
  const digest=createHash("sha256").update(token).digest("hex");
  const rows=await getAuthDatabase().execute<{email:string;company_name:string;role:string;expires_at:Date}>(
   sql`select * from app.invitation_preview(${digest})`);
  invited=rows[0];
 }
 return <main className="flex min-h-screen items-center justify-center bg-[#f3f8f6] p-5" dir="rtl">
   <div className="w-full max-w-lg rounded-3xl border bg-white p-8 shadow-lg">
    <h1 className="mb-2 text-3xl font-black text-[#19473f]">BUNYRA</h1>
    <h2 className="mb-4 text-xl font-bold">قبول دعوة الشركة</h2>
    {invited?<><p className="mb-5 text-sm text-slate-700">أُرسلت إليك دعوة للانضمام إلى
      <strong> {invited.company_name}</strong> باستخدام البريد <span dir="ltr">{invited.email}</span>.
    </p><InviteAcceptForm token={token}/></>:
    <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">رابط الدعوة غير صالح أو انتهت صلاحيته أو استُخدم من قبل.</p>}
    <p className="mt-6 text-xs text-slate-500">لا تشارك رابط الدعوة مع أي شخص آخر.</p>
   </div>
  </main>;
}
