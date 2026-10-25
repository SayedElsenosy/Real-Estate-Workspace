"use client";
import { useEffect, useMemo, useState } from "react";
import { Blocks, Building2, Layers3, Search, CalendarPlus, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/workspace/status-badge";
import { BookingDialog,type UnitForBooking } from "@/components/workspace/booking-dialog";
import { money } from "@/lib/utils";

type Project={id:string;name:string;location:string;status:string};
type Phase={id:string;projectId:string;name:string};
type Building={id:string;phaseId:string;name:string};
type Unit={id:string;buildingId:string;unitNumber:string;status:"AVAILABLE"|"BOOKED"|"SOLD";area:string;price:string};
export function InventoryClient({projects,phases,buildings,initialUnits,selectedProjectId,canBook,customers}:{
 projects:Project[];phases:Phase[];buildings:Building[];initialUnits:Unit[];customers:{id:string;fullName:string;phonePrimary:string}[];
 selectedProjectId:string|null;canBook:boolean;
}){
 const initialProject=projects.some(p=>p.id===selectedProjectId)?selectedProjectId:(projects[0]?.id??"");
 const [projectId,setProjectId]=useState(initialProject??"");
 const [phaseId,setPhaseId]=useState("");
 const [buildingId,setBuildingId]=useState("");
 const [search,setSearch]=useState("");
 const [units,setUnits]=useState(initialUnits);
 const [bookingUnit,setBookingUnit]=useState<UnitForBooking|null>(null);
 const [success,setSuccess]=useState("");
 useEffect(()=>setUnits(initialUnits),[initialUnits]);
 const chosenPhases=useMemo(()=>phases.filter(p=>p.projectId===projectId),[phases,projectId]);
 const currentPhase=chosenPhases.some(p=>p.id===phaseId)?phaseId:(chosenPhases[0]?.id??"");
 const chosenBuildings=buildings.filter(b=>b.phaseId===currentPhase);
 const currentBuilding=chosenBuildings.some(b=>b.id===buildingId)?buildingId:(chosenBuildings[0]?.id??"");
 const visible=units.filter(u=>u.buildingId===currentBuilding&&u.unitNumber.toLowerCase().includes(search.trim().toLowerCase()));
 const projectName=projects.find(p=>p.id===projectId)?.name??"";
 return <div>
  <div className="mb-6 grid gap-4 lg:grid-cols-3">
    <label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#66817b]"><Building2 className="size-4"/> المشروع</span>
      <select aria-label="اختر المشروع" value={projectId} onChange={e=>{setProjectId(e.target.value);setPhaseId("");setBuildingId("");setSuccess("");}} className="w-full rounded-xl border border-[#dce6e4] bg-white px-4 py-3 text-sm text-[#214941]">
        {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
    <label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#66817b]"><Layers3 className="size-4"/> المرحلة</span>
      <select aria-label="اختر المرحلة" value={currentPhase} onChange={e=>{setPhaseId(e.target.value);setBuildingId("");}} className="w-full rounded-xl border border-[#dce6e4] bg-white px-4 py-3 text-sm text-[#214941]">
        {chosenPhases.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
    <label className="block"><span className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#66817b]"><Blocks className="size-4"/> المبنى</span>
      <select aria-label="اختر المبنى" value={currentBuilding} onChange={e=>setBuildingId(e.target.value)} className="w-full rounded-xl border border-[#dce6e4] bg-white px-4 py-3 text-sm text-[#214941]">
        {chosenBuildings.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
      </select></label>
  </div>
  <Card className="overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e8eeeb] p-6">
      <div><h2 className="text-lg font-bold text-[#193f37]">وحدات {projectName}</h2><p className="mt-1 text-sm text-[#82968f]">{visible.length} وحدة في المبنى المحدد</p></div>
      <div className="relative"><Search className="absolute top-3 right-3 size-4 text-[#97aaa5]"/><Input aria-label="بحث عن وحدة" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث برقم الوحدة" className="w-[210px] pr-10"/></div>
    </div>
    {success&&<p role="status" className="mx-6 mt-5 flex items-center gap-2 rounded-xl bg-[#e6f6ed] px-4 py-3 text-sm text-[#147456]"><ShieldCheck className="size-4"/> تم تأكيد الحجز، وتحديث حالة الوحدة.</p>}
    <Table><TableHeader><TableRow><TableHead>رقم الوحدة</TableHead><TableHead>المساحة</TableHead><TableHead>السعر</TableHead><TableHead>الحالة</TableHead><TableHead>الإجراء</TableHead></TableRow></TableHeader>
      <TableBody>{visible.map(unit=><TableRow key={unit.id} data-testid={`unit-row-${unit.unitNumber}`}>
       <TableCell><span className="font-bold text-[#183c37]">{unit.unitNumber}</span></TableCell>
       <TableCell>{unit.area} م²</TableCell><TableCell><span dir="ltr" className="inline-block font-semibold">{money(unit.price)}</span></TableCell>
       <TableCell><StatusBadge status={unit.status}/></TableCell>
       <TableCell>{unit.status==="AVAILABLE"&&canBook?
         <Button size="sm" variant="secondary" onClick={()=>{setSuccess("");setBookingUnit(unit);}}><CalendarPlus className="size-4"/> حجز</Button>:
         <span className="text-xs text-[#9baba6]">{unit.status!=="AVAILABLE"?"غير متاح": "صلاحية العرض فقط"}</span>}</TableCell>
      </TableRow>)}</TableBody>
    </Table>
    {visible.length===0&&<div className="p-14 text-center text-sm text-[#9aaba6]">لا توجد وحدات مطابقة للاختيار الحالي.</div>}
  </Card>
  <BookingDialog customers={customers} unit={bookingUnit} onClose={()=>setBookingUnit(null)} onSuccess={id=>{
   setUnits(old=>old.map(u=>u.id===id?{...u,status:"BOOKED"}:u));
   setSuccess("تم تأكيد الحجز، وتحديث حالة الوحدة.");
  }}/>
 </div>;
}
