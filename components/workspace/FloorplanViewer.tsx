"use client";

import { useState } from "react";
import { money } from "@/lib/utils";

/** Trusted geometry consists only of coordinates, NEVER arbitrary uploaded SVG markup. */
export type FloorplanUnit = {
 id:string; unitNumber:string; status:"AVAILABLE"|"BOOKED"|"SOLD";
 area:string; price:string; svgCoordinates:unknown;
};
type Shape={points:string;centerX:number;centerY:number};
function shapeOf(value:unknown):Shape|null {
 if (!value || typeof value!=="object" || Array.isArray(value)) return null;
 const data=value as Record<string,unknown>;
 const raw=data.points;
 if (!Array.isArray(raw) || raw.length<3 || raw.length>24) return null;
 const coords:number[][]=[];
 for(const point of raw){
  if(!Array.isArray(point)||point.length!==2||point.some(n=>typeof n!=="number"||!Number.isFinite(n)||n<0||n>800))return null;
  coords.push(point as number[]);
 }
 const cx=coords.reduce((x,p)=>x+p[0],0)/coords.length;
 const cy=coords.reduce((y,p)=>y+p[1],0)/coords.length;
 return {points:coords.map(p=>p.join(",")).join(" "),centerX:cx,centerY:cy};
}
const fallbackShapes:Shape[]=[
 {points:"60,75 330,75 330,245 60,245",centerX:195,centerY:160},
 {points:"355,75 625,75 625,245 355,245",centerX:490,centerY:160},
 {points:"60,270 330,270 330,440 60,440",centerX:195,centerY:355},
 {points:"355,270 625,270 625,440 355,440",centerX:490,centerY:355},
];
const fill={AVAILABLE:"#6bca93",BOOKED:"#efab62",SOLD:"#a9b2b8"} as const;
const statusName={AVAILABLE:"متاحة",BOOKED:"محجوزة",SOLD:"مباعة"};
export function FloorplanViewer({units,canBook,onBook}:{units:FloorplanUnit[];canBook:boolean;onBook:(unit:FloorplanUnit)=>void}){
 const [hover,setHover]=useState<string|null>(null);
 // Fallback layout only for the four demo units; real maps MUST use stored coordinates.
 const demo=units.length<=4 && units.every(u=>u.svgCoordinates===null);
 const mapped=units.map((unit,i)=>({unit,shape:shapeOf(unit.svgCoordinates)??(demo?fallbackShapes[i]??null:null)})).filter((x):x is {unit:FloorplanUnit;shape:Shape}=>x.shape!==null);
 const active=mapped.find(x=>x.unit.id===hover);
 return <section aria-label="المخطط التفاعلي" className="p-5 sm:p-7">
  <div className="mb-5 flex flex-wrap items-center gap-4 text-xs">
   {(["AVAILABLE","BOOKED","SOLD"] as const).map(s=><div key={s} className="flex items-center gap-2"><span className="size-3 rounded" style={{backgroundColor:fill[s]}}/>{statusName[s]}</div>)}
   {demo&&<span className="mr-auto text-amber-700">مخطط توضيحي لأربع وحدات — ليس مخططًا هندسيًا معتمدًا</span>}
  </div>
  <div className="relative mx-auto max-w-[800px]">
   <svg aria-label="مخطط وحدات المبنى" viewBox="0 0 685 515" xmlns="http://www.w3.org/2000/svg" className="w-full rounded-2xl border border-[#e2eae7] bg-[#f8fbf9]">
    <rect x="24" y="30" width="637" height="440" rx="12" fill="#e9efed" stroke="#bbcfc9" strokeWidth="3"/>
    <path d="M342 35 V468" stroke="#f8fbf9" strokeWidth="18"/>
    {mapped.map(({unit,shape})=><g key={unit.id} data-testid={`floorplan-unit-${unit.unitNumber}`}
     role="button" aria-label={`الوحدة ${unit.unitNumber} - ${statusName[unit.status]}`}
     aria-disabled={unit.status!=="AVAILABLE"||!canBook}
     tabIndex={unit.status==="AVAILABLE"&&canBook?0:-1}
     onMouseEnter={()=>setHover(unit.id)} onMouseLeave={()=>setHover(null)}
     onFocus={()=>setHover(unit.id)} onBlur={()=>setHover(null)}
     onClick={()=>{if(unit.status==="AVAILABLE"&&canBook)onBook(unit);}}
     onKeyDown={e=>{if((e.key==="Enter"||e.key===" ")&&unit.status==="AVAILABLE"&&canBook){e.preventDefault();onBook(unit);}}}
     className={unit.status==="AVAILABLE"&&canBook?"cursor-pointer outline-none":"cursor-default"}>
     <polygon points={shape.points} fill={fill[unit.status]} fillOpacity={hover===unit.id?1:0.82} stroke="#fff" strokeWidth={hover===unit.id?6:4} className="transition-all duration-200"/>
     <text x={shape.centerX} y={shape.centerY-2} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#183a36" pointerEvents="none">{unit.unitNumber}</text>
     <text x={shape.centerX} y={shape.centerY+24} textAnchor="middle" fontSize="13" fill="#234e47" pointerEvents="none">{statusName[unit.status]}</text>
    </g>)}
    <text x="342" y="495" textAnchor="middle" fontSize="13" fill="#738882">مدخل المبنى</text>
   </svg>
   {active&&<div role="tooltip" className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-xl border border-[#deebe6] bg-white/95 p-4 text-sm shadow-xl">
      <strong>الوحدة {active.unit.unitNumber}</strong>
      <p className="mt-1 text-[#6f8981]">المساحة: {active.unit.area} م²</p>
      <p className="mt-1 text-[#176f65]">{money(active.unit.price)}</p>
      <p className="mt-1 text-[#6f8981]">{statusName[active.unit.status]}</p>
   </div>}
  </div>
  {!mapped.length&&<p className="py-10 text-center text-sm text-[#879a95]">لا توجد إحداثيات SVG معتمدة للوحدات في هذا المبنى.</p>}
  {mapped.length<units.length&&<p className="pt-3 text-xs text-amber-700">بعض الوحدات لا تحتوي على إحداثيات صحيحة؛ يمكن عرضها في الجدول.</p>}
 </section>;
}
