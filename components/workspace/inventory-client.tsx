"use client";
import {useTranslations} from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Blocks, Building2, Layers3, Search, CalendarPlus, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/workspace/status-badge";
import { BookingDialog,type UnitForBooking } from "@/components/workspace/booking-dialog";
import { money } from "@/lib/utils";
import { FloorplanViewer } from "@/components/workspace/FloorplanViewer";

type Project={id:string;name:string;location:string;status:string};
type Phase={id:string;projectId:string;name:string};
type Building={id:string;phaseId:string;name:string};
type Unit={id:string;buildingId:string;unitNumber:string;status:"AVAILABLE"|"BOOKED"|"SOLD";area:string;price:string;svgCoordinates:unknown};
export function InventoryClient({projects,phases,buildings,initialUnits,selectedProjectId,selectedPhaseId,selectedBuildingId,searchTerm,total,limit,canBook}:{
 projects:Project[];phases:Phase[];buildings:Building[];initialUnits:Unit[];
 selectedProjectId:string|null;selectedPhaseId:string|null;selectedBuildingId:string|null;
 searchTerm:string;total:number;limit:number;canBook:boolean;customers:{id:string;fullName:string;phonePrimary:string}[];
}){
 const router=useRouter();
 const t=useTranslations("inventory");
 const [search,setSearch]=useState(searchTerm);
 const [units,setUnits]=useState(initialUnits);
 const [bookingUnit,setBookingUnit]=useState<UnitForBooking|null>(null);
 const [success,setSuccess]=useState("");
 const [view,setView]=useState<"table"|"plan">("table");
 useEffect(()=>setUnits(initialUnits),[initialUnits]);
 useEffect(()=>setSearch(searchTerm),[searchTerm]);
 const projectId=selectedProjectId??"";
 const chosenPhases=phases.filter(p=>p.projectId===projectId);
 const currentPhase=selectedPhaseId??"";
 const chosenBuildings=buildings.filter(b=>b.phaseId===currentPhase);
 const currentBuilding=selectedBuildingId??"";
 const projectName=projects.find(p=>p.id===projectId)?.name??"";
 function href(values:{project?:string;phase?:string;building?:string;search?:string}){
  const p=new URLSearchParams();
  if(values.project)p.set("project",values.project);
  if(values.phase)p.set("phase",values.phase);
  if(values.building)p.set("building",values.building);
  if(values.search)p.set("search",values.search);
  if(limit!==20)p.set("limit",String(limit));
  return "/inventory"+(p.size?"?"+p.toString():"");
 }
 useEffect(()=>{
  if(search.trim()===searchTerm) return;
  const timer=setTimeout(()=>router.replace(href({project:projectId,phase:currentPhase,building:currentBuilding,search:search.trim()})),350);
  return ()=>clearTimeout(timer);
  // Selection and page size are URL-controlled; only search changes trigger this debounce.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[search,searchTerm,router,projectId,currentPhase,currentBuilding,limit]);
 return <div>
  <div className="mb-6 grid gap-4 lg:grid-cols-3">
    <label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#66817b]"><Building2 className="size-4"/> {t("project")}</span>
      <select aria-label={t("chooseProject")} value={projectId} onChange={e=>{setSearch("");setSuccess("");router.push(href({project:e.target.value}));}}
        className="w-full rounded-xl border border-[#dce6e4] bg-white px-4 py-3 text-sm text-[#214941]">
        {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
    <label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#66817b]"><Layers3 className="size-4"/> {t("phase")}</span>
      <select aria-label={t("choosePhase")} value={currentPhase}
        onChange={e=>{setSearch("");router.push(href({project:projectId,phase:e.target.value}));}}
        className="w-full rounded-xl border border-[#dce6e4] bg-white px-4 py-3 text-sm text-[#214941]">
        {chosenPhases.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
    <label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#66817b]"><Blocks className="size-4"/> {t("building")}</span>
      <select aria-label={t("chooseBuilding")} value={currentBuilding}
        onChange={e=>{setSearch("");router.push(href({project:projectId,phase:currentPhase,building:e.target.value}));}}
        className="w-full rounded-xl border border-[#dce6e4] bg-white px-4 py-3 text-sm text-[#214941]">
        {chosenBuildings.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
      </select></label>
  </div>
  <Card className="overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e8eeeb] p-6">
      <div><h2 className="text-lg font-bold text-[#193f37]">{t("unitsOf",{project:projectName})}</h2>
        <p className="mt-1 text-sm text-[#82968f]">{t("unitsCount",{total,shown:units.length})}</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2"><Button size="sm" variant={view==="table"?"default":"outline"} onClick={()=>setView("table")}>{t("tableView")}</Button><Button size="sm" variant={view==="plan"?"default":"outline"} onClick={()=>setView("plan")}>{t("planView")}</Button></div>
        <div className="relative"><Search className="absolute top-3 right-3 size-4 text-[#97aaa5]"/>
          <Input aria-label={t("findUnit")} value={search} onChange={e=>setSearch(e.target.value)}
            placeholder={t("searchNumber")} className="w-[210px] pr-10"/>
        </div>
      </div>
    </div>
    {success&&<p role="status" className="mx-6 mt-5 flex items-center gap-2 rounded-xl bg-[#e6f6ed] px-4 py-3 text-sm text-[#147456]"><ShieldCheck className="size-4"/> {t("success")}</p>}
    {view==="plan"?<><p className="px-6 pt-3 text-xs text-amber-700">{t("planWarning")}</p>
      <FloorplanViewer units={units} canBook={canBook} onBook={unit=>{setSuccess("");setBookingUnit(unit);}}/></>:
      <><Table><TableHeader><TableRow><TableHead>{t("number")}</TableHead><TableHead>{t("area")}</TableHead><TableHead>{t("price")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("action")}</TableHead></TableRow></TableHeader>
        <TableBody>{units.map(unit=><TableRow key={unit.id} data-testid={"unit-row-"+unit.unitNumber}>
          <TableCell><span className="font-bold text-[#183c37]">{unit.unitNumber}</span></TableCell>
          <TableCell>{unit.area} م²</TableCell><TableCell><span dir="ltr" className="inline-block font-semibold">{money(unit.price)}</span></TableCell>
          <TableCell><StatusBadge status={unit.status}/></TableCell>
          <TableCell>{unit.status==="AVAILABLE"&&canBook?
            <Button size="sm" variant="secondary" onClick={()=>{setSuccess("");setBookingUnit(unit);}}><CalendarPlus className="size-4"/> {t("book")}</Button>:
            <span className="text-xs text-[#9baba6]">{unit.status!=="AVAILABLE"?t("unavailable"):t("readonly")}</span>}</TableCell>
        </TableRow>)}</TableBody></Table>
        {units.length===0&&<div className="p-14 text-center text-sm text-[#9aaba6]">{t("empty")}</div>}</>}
  </Card>
  <BookingDialog customers={[]} unit={bookingUnit} onClose={()=>setBookingUnit(null)} onSuccess={id=>{
    setUnits(old=>old.map(u=>u.id===id?{...u,status:"BOOKED"}:u));setSuccess(t("success"));
  }}/>
 </div>;
}
