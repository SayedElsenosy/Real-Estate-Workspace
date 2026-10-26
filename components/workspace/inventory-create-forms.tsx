"use client";
import {useState} from "react";import Link from "next/link";import {useRouter} from "next/navigation";
import {Card} from "@/components/ui/card";import {Button} from "@/components/ui/button";import {Input} from "@/components/ui/input";
type Option={id:string;name:string};
export function InventoryCreateForms({initialProjects,initialPhases,initialBuildings}:{initialProjects:Option[];initialPhases:(Option&{projectId:string})[];initialBuildings:(Option&{phaseId:string})[]}){
 const router=useRouter();
 const [projects,setProjects]=useState(initialProjects),[phases,setPhases]=useState(initialPhases),[buildings,setBuildings]=useState(initialBuildings);
 const [projectId,setProjectId]=useState(initialProjects[0]?.id||"");
 const [phaseId,setPhaseId]=useState(initialPhases.find(p=>p.projectId===initialProjects[0]?.id)?.id||"");
 const [buildingId,setBuildingId]=useState("");
 const [busy,setBusy]=useState(""),[message,setMessage]=useState("");
 const phaseOptions=phases.filter(p=>p.projectId===projectId);
 const buildingOptions=buildings.filter(b=>b.phaseId===phaseId);
 async function submit(path:string,payload:Record<string,string>,kind:"project"|"phase"|"building"|"unit"){
  setMessage("");setBusy(kind);
  try{
   const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const result=await response.json();if(!response.ok)throw Error(result.error||"تعذر الحفظ");
   const item=result.created as Option;
   if(kind==="project"){setProjects(p=>[...p,item]);setProjectId(item.id);setPhaseId("");setBuildingId("");}
   if(kind==="phase"){setPhases(p=>[...p,{...item,projectId}]);setPhaseId(item.id);setBuildingId("");}
   if(kind==="building"){setBuildings(p=>[...p,{...item,phaseId}]);setBuildingId(item.id);}
   setMessage("تم حفظ "+({project:"المشروع",phase:"المرحلة",building:"المبنى",unit:"الوحدة"}[kind])+" بنجاح");
   router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:"تعذر الحفظ");}finally{setBusy("");}
 }
 const Label=({children}:{children:React.ReactNode})=><span className="mb-1 block text-sm font-semibold">{children}</span>;
 return <div className="space-y-5">
  {message&&<p role="status" className="rounded-xl bg-[#edf7f2] p-3 text-sm">{message}</p>}
  <div className="grid gap-5 lg:grid-cols-2">
  <Card className="p-5"><h2 className="mb-4 text-lg font-bold">1. إنشاء مشروع</h2><form className="space-y-3" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await submit("/api/projects",{name:String(f.get("name")),location:String(f.get("location"))},"project");}}>
   <label><Label>اسم المشروع</Label><Input required name="name" maxLength={200} aria-label="اسم المشروع"/></label>
   <label><Label>الموقع</Label><Input required name="location" maxLength={300} aria-label="موقع المشروع"/></label>
   <Button disabled={!!busy}>حفظ المشروع</Button>
  </form></Card>
  <Card className="p-5"><h2 className="mb-4 text-lg font-bold">2. إنشاء مرحلة</h2><form className="space-y-3" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await submit("/api/phases",{project_id:projectId,name:String(f.get("name"))},"phase");}}>
   <label><Label>المشروع</Label><select aria-label="اختر المشروع" className="h-11 w-full rounded-xl border bg-white p-2" required value={projectId} onChange={e=>{setProjectId(e.target.value);setPhaseId("");setBuildingId("");}}><option value="">اختر مشروعًا</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label><Label>اسم المرحلة</Label><Input name="name" required maxLength={200} aria-label="اسم المرحلة"/></label>
   <Button disabled={!!busy||!projectId}>حفظ المرحلة</Button>
  </form></Card>
  <Card className="p-5"><h2 className="mb-4 text-lg font-bold">3. إنشاء مبنى</h2><form className="space-y-3" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await submit("/api/buildings",{phase_id:phaseId,name:String(f.get("name"))},"building");}}>
   <label><Label>المرحلة</Label><select aria-label="اختر المرحلة" className="h-11 w-full rounded-xl border bg-white p-2" required value={phaseId} onChange={e=>{setPhaseId(e.target.value);setBuildingId("");}}><option value="">اختر مرحلة</option>{phaseOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label><Label>اسم المبنى</Label><Input name="name" required maxLength={200} aria-label="اسم المبنى"/></label>
   <Button disabled={!!busy||!phaseId}>حفظ المبنى</Button>
  </form></Card>
  <Card className="p-5"><h2 className="mb-4 text-lg font-bold">4. إنشاء وحدة</h2><form className="space-y-3" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await submit("/api/units",{building_id:buildingId,unit_number:String(f.get("number")),area:String(f.get("area")),price:String(f.get("price"))},"unit");}}>
   <label><Label>المبنى</Label><select aria-label="اختر المبنى" className="h-11 w-full rounded-xl border bg-white p-2" required value={buildingId} onChange={e=>setBuildingId(e.target.value)}><option value="">اختر مبنى</option>{buildingOptions.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   <label><Label>رقم الوحدة</Label><Input name="number" required maxLength={200} aria-label="رقم الوحدة"/></label>
   <label><Label>المساحة (م²)</Label><Input name="area" type="number" step="0.01" min="0.01" required aria-label="المساحة"/></label>
   <label><Label>السعر (ج.م)</Label><Input name="price" type="number" step="0.01" min="0" required aria-label="سعر الوحدة"/></label>
   <Button disabled={!!busy||!buildingId}>حفظ الوحدة</Button>
  </form></Card>
  </div><Link href="/inventory" className="text-teal-700 underline">عرض المخزون بعد الإضافة</Link>
 </div>;
}
