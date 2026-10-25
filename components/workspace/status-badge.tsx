import { Badge } from "@/components/ui/badge";
const map:Record<string,{label:string;className:string}>={
 AVAILABLE:{label:"متاحة",className:"bg-[#e6f6ef] text-[#147d55]"},
 BOOKED:{label:"محجوزة",className:"bg-[#fff4df] text-[#ab7118]"},
 SOLD:{label:"مباعة",className:"bg-[#f0eefc] text-[#7564bc]"},
 PENDING:{label:"قيد الانتظار",className:"bg-[#fff4df] text-[#ab7118]"},
 CONFIRMED:{label:"مؤكد",className:"bg-[#e6f6ef] text-[#147d55]"},
 ACTIVE:{label:"نشط",className:"bg-[#e6f6ef] text-[#147d55]"},
 PLANNED:{label:"مخطط",className:"bg-[#f0eefc] text-[#7564bc]"},
 COMPLETED:{label:"مكتمل",className:"bg-[#e6f6ef] text-[#147d55]"},
 PAID:{label:"مدفوع",className:"bg-[#e6f6ef] text-[#147d55]"},
 OVERDUE:{label:"متأخر",className:"bg-[#fce9e9] text-[#b14242]"},
 CANCELLED:{label:"ملغي",className:"bg-[#fce9e9] text-[#b14242]"},
 DRAFT:{label:"مسودة",className:"bg-[#f0f2f4] text-[#667881]"},
 ON_HOLD:{label:"متوقف",className:"bg-[#fff4df] text-[#ab7118]"},
};
export function StatusBadge({status}:{status:string}){const x=map[status]??{label:status,className:"bg-slate-100 text-slate-600"};return <Badge className={x.className}>{x.label}</Badge>;}
