"use client";
import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table,TableHeader,TableRow,TableHead,TableBody,TableCell } from "@/components/ui/table";
export function CustomersSearch({customers,total}:{customers:{
  id:string;fullName:string;phonePrimary:string;phoneSecondary:string|null;email:string|null;
}[];total:number}){
 return <Card className="overflow-hidden"><div className="flex flex-wrap justify-between gap-3 p-5"><strong>العملاء المطابقون · {total}</strong></div>
   <Table><TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الهاتف</TableHead><TableHead>البريد</TableHead><TableHead>التفاصيل</TableHead></TableRow></TableHeader>
   <TableBody>{customers.map(c=><TableRow key={c.id}>
    <TableCell className="font-semibold">{c.fullName}</TableCell>
    <TableCell dir="ltr">{c.phonePrimary}</TableCell><TableCell>{c.email||"—"}</TableCell>
    <TableCell><Link href={"/customers/"+c.id} className="inline-flex items-center gap-1 font-semibold text-teal-700">Customer 360 <ArrowUpLeft className="size-4"/></Link></TableCell>
   </TableRow>)}</TableBody></Table>
   {!customers.length&&<p className="p-8 text-center text-sm text-[#8c9e99]">لا توجد نتائج مطابقة.</p>}
 </Card>;
}
