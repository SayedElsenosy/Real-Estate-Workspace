"use client";
import { useEffect,useState,useTransition } from "react";
import { useLocale,useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Moon,Sun,Languages } from "lucide-react";
import { setPreferredLocale } from "@/app/actions/preferences";
export function DisplayPreferences(){
 const locale=useLocale();
 const t=useTranslations("common");
 const {resolvedTheme,setTheme}=useTheme();
 const [mounted,setMounted]=useState(false);
 const [busy,startTransition]=useTransition();
 const router=useRouter();
 useEffect(()=>setMounted(true),[]);
 function changeLanguage(value:"ar"|"en"){
  startTransition(async()=>{await setPreferredLocale(value);router.refresh();});
 }
 return <div className="flex items-center gap-2" aria-label={t("language")}>
  <label className="flex items-center gap-1 text-xs"><Languages className="size-4"/>
   <select aria-label={t("language")} value={locale} disabled={busy} onChange={e=>changeLanguage(e.target.value as "ar"|"en")}
    className="rounded-lg border border-[#dce6e4] bg-white px-2 py-1 text-sm">
    <option value="ar">{t("arabic")}</option><option value="en">{t("english")}</option>
   </select>
  </label>
  <button type="button" title={mounted&&resolvedTheme==="dark"?t("light"):t("dark")}
    aria-label={mounted&&resolvedTheme==="dark"?t("light"):t("dark")}
    onClick={()=>setTheme(resolvedTheme==="dark"?"light":"dark")}
    className="rounded-lg border border-[#dce6e4] bg-white p-2" disabled={!mounted}>
    {mounted&&resolvedTheme==="dark"?<Sun className="size-4"/>:<Moon className="size-4"/>}
  </button>
 </div>;
}
