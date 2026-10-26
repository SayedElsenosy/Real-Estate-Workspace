"use client";
import {useTranslations} from "next-intl";
import {useEffect} from "react";
import {AlertTriangle} from "lucide-react";
import {Button} from "@/components/ui/button";
export default function WorkspaceError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const t=useTranslations("ui");
 useEffect(()=>{console.error("Workspace rendering failed",error.digest||error.name);},[error]);
 return <section role="alert" className="mx-auto my-12 max-w-lg rounded-2xl border border-red-100 bg-white p-9 text-center shadow-sm"><AlertTriangle className="mx-auto mb-4 size-10 text-amber-600"/><h2 className="text-xl font-bold">{t("workspaceErrorTitle")}</h2><p className="my-4 text-slate-600">{t("workspaceErrorBody")}</p><Button onClick={reset}>{t("retry")}</Button></section>;
}
