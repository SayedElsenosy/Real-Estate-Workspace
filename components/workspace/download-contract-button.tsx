import {useTranslations} from "next-intl";
"use client";
import {useState} from "react";
import {Button} from "@/components/ui/button";
export function DownloadContractButton({id}:{id:string}){
 const t=useTranslations("ui");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function download(){
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/contracts/"+id+"/generate-docx",{method:"POST"});
   if(!response.ok){const body=await response.json();throw Error(body.error||t("downloadError"));}
   const objectUrl=URL.createObjectURL(await response.blob());
   const link=document.createElement("a");
   link.href=objectUrl;link.download="contract-"+id.slice(0,8)+".docx";link.click();
   setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
  }catch(e){setError(e instanceof Error?e.message:t("downloadError"));}
  finally{setBusy(false);}
 }
 return <div><Button disabled={busy} onClick={download}>{busy?t("generating"):t("downloadContract")}</Button>{error&&<p role="alert">{error}</p>}</div>;
}
