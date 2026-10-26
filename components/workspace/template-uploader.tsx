import {useTranslations} from "next-intl";
"use client";
import {useState} from "react";import {useRouter} from "next/navigation";import {Button} from "@/components/ui/button";import {Input} from "@/components/ui/input";
export function TemplateUploader(){
 const t=useTranslations("ui");
 const [name,setName]=useState(t("templateDefaultName")),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const router=useRouter();
 async function upload(e:React.FormEvent){e.preventDefault();if(!file)return;setBusy(true);setMessage("");
 try{const body=new FormData();body.set("name",name);body.set("file",file);const res=await fetch("/api/contract-templates",{method:"POST",body});
 const json=await res.json();if(!res.ok)throw Error(json.error||t("uploadFail"));
 setMessage(t("templateUploaded"));router.refresh();
 }catch(e){setMessage(e instanceof Error?e.message:t("uploadFail"));}finally{setBusy(false);}
 }
 return <div className="space-y-4"><a className="text-teal-700 underline" href="/api/contract-templates/sample">{t("templateDownloadSample")}</a>
 <form onSubmit={upload} className="max-w-lg space-y-3">
 <label className="block">{t("templateName")}<Input aria-label={t("templateName")} required value={name} onChange={e=>setName(e.target.value)}/></label>
 <label className="block">{t("templateMax")}<input aria-label={t("templateFile")} type="file" accept=".docx" required className="block w-full py-2" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
 <Button disabled={busy||!file}>{busy?t("uploading"):t("upload")}</Button></form>
 {message&&<p role="status">{message}</p>}
 </div>;
}
