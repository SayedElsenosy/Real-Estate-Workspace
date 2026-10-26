import {getServerI18n} from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { getDatabaseSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/workspace/login-form";
export const dynamic="force-dynamic";
export default async function LoginPage() {
 const {t}=await getServerI18n();
 const loggedIn=await getDatabaseSession();
 if(loggedIn)redirect("/dashboard");
 return <main className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-[#f3f8f6] px-5 py-10">
  <div className="pointer-events-none absolute -top-44 -right-44 size-[550px] rounded-full bg-[#d5eee6] opacity-60 blur-3xl"/>
  <div className="pointer-events-none absolute -bottom-72 -left-40 size-[630px] rounded-full bg-[#e5ece4] opacity-80 blur-3xl"/>
  <div className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-[30px] border border-[#e0ebe6] bg-white shadow-[0_20px_100px_rgba(17,60,48,.08)] md:grid-cols-2">
    <div className="order-2 flex min-h-[360px] flex-col justify-between bg-[#19473f] p-9 text-white md:order-1 md:p-12">
     <p className="text-sm tracking-[.1em] text-[#8ecdbb]">BUNYRA · ERP & CRM</p>
     <div><h1 className="text-4xl font-black leading-tight md:text-5xl">مستقبل إدارة<br/>التطوير العقاري.</h1><p className="mt-5 max-w-xs leading-8 text-[#c9dcd5]">من المشروعات والمخزون إلى الحجوزات والعقود والمقبوضات. تجربة تشغيل واحدة ومتصلة.</p></div>
     <div className="flex items-center gap-2 text-xs text-[#a7cec2]"><span className="size-2 rounded-full bg-[#65d4a8]"/> دخول آمن · مساحة عمل شركتك</div>
    </div>
    <div className="order-1 flex flex-col justify-center px-7 py-12 md:order-2 md:p-12">
     <p className="mb-2 text-sm font-bold text-[#248a7d]">BUNYRA</p><h2 className="mb-2 text-3xl font-black text-[#164138]">{t("forms.signIn")}</h2>
     <p className="mb-8 text-sm leading-7 text-[#8a9f98]">سجّل الدخول باستخدام بريدك الإلكتروني وكلمة المرور.</p>
     <LoginForm/>
     <p className="mt-7 text-xs leading-6 text-[#9aaba5]">للحصول على حساب أو استعادة الوصول، تواصل مع مسؤول شركتك.</p>
    </div>
  </div>
 </main>;
}
