"use client";
import {useTranslations} from "next-intl";
import {Badge} from "@/components/ui/badge";
const map:Record<string,string>={
 AVAILABLE:"bg-[#e6f6ef] text-[#147d55]",
 BOOKED:"bg-[#fff4df] text-[#ab7118]",
 SOLD:"bg-[#f0eefc] text-[#7564bc]",
 PENDING:"bg-[#fff4df] text-[#ab7118]",
 CONFIRMED:"bg-[#e6f6ef] text-[#147d55]",
 ACTIVE:"bg-[#e6f6ef] text-[#147d55]",
 PLANNED:"bg-[#f0eefc] text-[#7564bc]",
 COMPLETED:"bg-[#e6f6ef] text-[#147d55]",
 PAID:"bg-[#e6f6ef] text-[#147d55]",
 OVERDUE:"bg-[#fce9e9] text-[#b14242]",
 CANCELLED:"bg-[#fce9e9] text-[#b14242]",
 DRAFT:"bg-[#f0f2f4] text-[#667881]",
 ON_HOLD:"bg-[#fff4df] text-[#ab7118]",
};
type Status="AVAILABLE"|"BOOKED"|"SOLD"|"PENDING"|"CONFIRMED"|"ACTIVE"|"PLANNED"|"COMPLETED"|"PAID"|"OVERDUE"|"CANCELLED"|"DRAFT"|"ON_HOLD";
export function StatusBadge({status}:{status:string}){
 const t=useTranslations("statuses");
 return <Badge className={map[status]??"bg-slate-100 text-slate-600"}>
   {Object.prototype.hasOwnProperty.call(map,status)?t(status as Status):status}
 </Badge>;
}
