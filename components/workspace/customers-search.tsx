"use client";
import Link from "next/link";
import {useState} from "react";
import { Search,ArrowUpLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table,TableHeader,TableRow,TableHead,TableBody,TableCell } from "@/components/ui/table";
export function CustomersSearch({customers}:{customers:{id:string;fullName:string;phonePrimary:string;phoneSecondary:string|null;email:string|null}[]}){
 const [q,setQ]=useState("");
 const found=customers.filter(c=>(c.fullName+" "+c.phonePrimary+" "+(c.phoneSecondary||"")).toLocaleLowerCase().includes(q.toLocaleLowerCase().trim()));
 return <Card className="overflow-hidden"><div className="flex flex-wrap justify-between gap-3 p-5"><strong>كل العملاء · {found.length}</strong><div className="relative"><Search className="absolute top-3 right-3 size-4 text-[#899e98]"/><Input aria-label="بحث العملاء" value={q} onChange={e=>setQ(e.target.value)} placeholder="اسم العميل أو رقم الهاتف" className="pr-10"/></div></div>
 <Table><TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الهاتف</TableHead><TableHead>البريد</TableHead><TableHead>التفاصيل</TableHead></TableRow></TableHeader>
 <TableBody>{found.map(c=><TableRow key={c.id}><TableCell className="font-semibold">{c.fullName}</TableCell><TableCell dir="ltr">{c.phonePrimary}</TableCell><TableCell>{c.email||"—"}</TableCell><TableCell><Link href={`/customers/${c.id}`} className="inline-flex items-center gap-1 font-semibold text-teal-700">Customer 360 <ArrowUpLeft className="size-4"/></Link></TableCell></TableRow>)}</TableBody></Table>
 {!found.length&&<p className="p-8 text-center text-sm text-[#8c9e99]">لا توجد نتائج مطابقة.</p>}</Card>;
}
