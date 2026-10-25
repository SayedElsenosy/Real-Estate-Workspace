"use client";
import {useState} from "react";import {useRouter} from "next/navigation";import {Button} from "@/components/ui/button";import {Input} from "@/components/ui/input";
export function TemplateUploader(){
 const [name,setName]=useState("عقد بيع ابتدائي"),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const router=useRouter();
 async function upload(e:React.FormEvent){e.preventDefault();if(!file)return;setBusy(true);setMessage("");
 try{const body=new FormData();body.set("name",name);body.set("file",file);const res=await fetch("/api/contract-templates",{method:"POST",body});
 const json=await res.json();if(!res.ok)throw Error(json.error||"تعذر الرفع");
 setMessage("تم رفع القالب بنجاح");router.refresh();
 }catch(e){setMessage(e instanceof Error?e.message:"فشل الرفع");}finally{setBusy(false);}
 }
 return <div className="space-y-4"><a className="text-teal-700 underline" href="/api/contract-templates/sample">تحميل قالب تجريبي Word</a>
 <form onSubmit={upload} className="max-w-lg space-y-3">
 <label className="block">اسم القالب<Input aria-label="اسم القالب" required value={name} onChange={e=>setName(e.target.value)}/></label>
 <label className="block">قالب DOCX حتى 5 ميجابايت<input aria-label="ملف قالب Word" type="file" accept=".docx" required className="block w-full py-2" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
 <Button disabled={busy||!file}>{busy?"جارٍ الرفع...":"رفع القالب"}</Button></form>
 {message&&<p role="status">{message}</p>}
 </div>;
}
