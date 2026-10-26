"use client";
import {useTranslations} from "next-intl";
import {useState} from "react";import Link from "next/link";import {useRouter} from "next/navigation";
import {Card} from "@/components/ui/card";import {Button} from "@/components/ui/button";import {Input} from "@/components/ui/input";
type Option={id:string;name:string};
export function InventoryCreateForms({initialProjects,initialPhases,initialBuildings}:{initialProjects:Option[];initialPhases:(Option&{projectId:string})[];initialBuildings:(Option&{phaseId:string})[]}){
 const router=useRouter();
 const t=useTranslations("inventoryForm"),ui=useTranslations("inventory");
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
   const result=await response.json();if(!response.ok)throw Error(result.error||t("saveError"));
   const item=result.created as Option;
   if(kind==="project"){setProjects(p=>[...p,item]);setProjectId(item.id);setPhaseId("");setBuildingId("");}
   if(kind==="phase"){setPhases(p=>[...p,{...item,projectId}]);setPhaseId(item.id);setBuildingId("");}
   if(kind==="building"){setBuildings(p=>[...p,{...item,phaseId}]);setBuildingId(item.id);}
   setMessage(t("saved",{entity:({project:ui("project"),phase:ui("phase"),building:ui("building"),unit:t("unit")})[kind]}));
   router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:t("saveError"));}finally{setBusy("");}
 }
 const Label=({children}:{children:React.ReactNode})=><span className="mb-1 block text-sm font-semibold">{children}</span>;
 return <div className="space-y-5">
  {message&&<p role="status" className="rounded-xl bg-[#edf7f2] p-3 text-sm">{message}</p>}
  <div className="grid gap-5 lg:grid-cols-2">
  <Card className="p-5"><h2 className="mb-4 text-lg font-bold">1. {t("project")}</h2><form className="space-y-3" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await submit("/api/projects",{name:String(f.get("name")),location:String(f.get("location"))},"project");}}>
   <label><Label>{t("projectName")}</Label><Input required name="name" maxLength={200} aria-label={t("projectName")}/></label>
   <label><Label>{t("location")}</Label><Input required name="location" maxLength={300} aria-label={t("projectLocation")}/></label>
   <Button disabled={!!busy}>{t("saveProject")}</Button>
  </form></Card>
  <Card className="p-5"><h2 className="mb-4 text-lg font-bold">2. {t("phase")}</h2><form className="space-y-3" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await submit("/api/phases",{project_id:projectId,name:String(f.get("name"))},"phase");}}>
   <label><Label>{ui("project")}</Label><select aria-label={ui("chooseProject")} className="h-11 w-full rounded-xl border bg-white p-2" required value={projectId} onChange={e=>{setProjectId(e.target.value);setPhaseId("");setBuildingId("");}}><option value="">{t("selectProject")}</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label><Label>{t("phaseName")}</Label><Input name="name" required maxLength={200} aria-label={t("phaseName")}/></label>
   <Button disabled={!!busy||!projectId}>{t("savePhase")}</Button>
  </form></Card>
  <Card className="p-5"><h2 className="mb-4 text-lg font-bold">3. {t("building")}</h2><form className="space-y-3" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await submit("/api/buildings",{phase_id:phaseId,name:String(f.get("name"))},"building");}}>
   <label><Label>{ui("phase")}</Label><select aria-label={ui("choosePhase")} className="h-11 w-full rounded-xl border bg-white p-2" required value={phaseId} onChange={e=>{setPhaseId(e.target.value);setBuildingId("");}}><option value="">{t("selectPhase")}</option>{phaseOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label><Label>{t("buildingName")}</Label><Input name="name" required maxLength={200} aria-label={t("buildingName")}/></label>
   <Button disabled={!!busy||!phaseId}>{t("saveBuilding")}</Button>
  </form></Card>
  <Card className="p-5"><h2 className="mb-4 text-lg font-bold">4. {t("unit")}</h2><form className="space-y-3" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await submit("/api/units",{building_id:buildingId,unit_number:String(f.get("number")),area:String(f.get("area")),price:String(f.get("price"))},"unit");}}>
   <label><Label>{ui("building")}</Label><select aria-label={ui("chooseBuilding")} className="h-11 w-full rounded-xl border bg-white p-2" required value={buildingId} onChange={e=>setBuildingId(e.target.value)}><option value="">{t("selectBuilding")}</option>{buildingOptions.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   <label><Label>{t("unitNumber")}</Label><Input name="number" required maxLength={200} aria-label={t("unitNumber")}/></label>
   <label><Label>{t("area")}</Label><Input name="area" type="number" step="0.01" min="0.01" required aria-label={t("areaLabel")}/></label>
   <label><Label>{t("price")}</Label><Input name="price" type="number" step="0.01" min="0" required aria-label={t("unitPrice")}/></label>
   <Button disabled={!!busy||!buildingId}>{t("saveUnit")}</Button>
  </form></Card>
  </div><Link href="/inventory" className="text-teal-700 underline">{t("viewInventory")}</Link>
 </div>;
}
