import {businessDate} from "@/lib/utils/date";
import {notFound} from "next/navigation";
import Link from "next/link";
import {PageHeader} from "@/components/workspace/page-header";
import {Card} from "@/components/ui/card";
import {StatusBadge} from "@/components/workspace/status-badge";
import {money} from "@/lib/utils";
import {loadWorkspace} from "@/lib/workspace/server-data";
export default async function CustomerDetails({params}:{params:Promise<{id:string}>}){
 const data=await loadWorkspace(),{id}=await params;
 const customer=data.customers.find(c=>c.id===id);
 if(!customer)notFound();
 const bookings=data.bookings.filter(b=>b.customerId===id);
 const ids=new Set(bookings.map(b=>b.id));
 const contracts=data.contracts.filter(c=>ids.has(c.bookingId));
 return <><PageHeader eyebrow="العملاء / CUSTOMER 360" title={customer.fullName} description="ملف العميل الموحد داخل الشركة."/>
 <div className="mb-5"><Link href="/customers" className="text-sm font-bold text-teal-700">العودة لقائمة العملاء</Link></div>
 <div className="grid gap-5 md:grid-cols-3">
 <Card className="p-6"><p className="text-sm text-slate-500">الهاتف الأساسي</p><p className="mt-2 font-bold" dir="ltr">{customer.phonePrimary}</p><p className="mt-5 text-sm text-slate-500">الهاتف الإضافي</p><p className="mt-1">{customer.phoneSecondary||"—"}</p><p className="mt-5 text-sm text-slate-500">البريد الإلكتروني</p><p className="mt-1">{customer.email||"—"}</p></Card>
 <Card className="p-6 md:col-span-2"><h2 className="mb-4 text-lg font-bold">الحجوزات · {bookings.length}</h2><div className="space-y-3">{bookings.map(b=><div key={b.id} className="flex items-center justify-between border-b py-3"><div><p className="font-semibold">الوحدة {data.units.find(u=>u.id===b.unitId)?.unitNumber||"—"}</p><p className="text-xs text-slate-500">{businessDate(b.bookingDate)}</p></div><StatusBadge status={b.status}/></div>)}{!bookings.length&&<p className="text-sm text-slate-500">لا توجد حجوزات مرتبطة.</p>}</div></Card>
 </div><Card className="mt-5 p-6"><h2 className="mb-4 text-lg font-bold">العقود · {contracts.length}</h2>{contracts.map(c=><div key={c.id} className="flex justify-between border-b py-3"><span dir="ltr">{c.id.slice(0,8)}</span><span>{money(c.totalAmount)}</span><StatusBadge status={c.status}/></div>)}{!contracts.length&&<p className="text-sm text-slate-500">لا توجد عقود مرتبطة بعد.</p>}</Card>
 </>;
}
