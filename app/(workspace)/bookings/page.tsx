import { loadWorkspace } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { Card } from "@/components/ui/card";
import { Table,TableHeader,TableRow,TableHead,TableBody,TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/workspace/status-badge";
export default async function BookingsPage(){
 const d=await loadWorkspace();
 return <><PageHeader eyebrow="المبيعات / BOOKINGS" title="الحجوزات" description="حجوزات العملاء المسجلة داخل شركتك."/><Card className="overflow-hidden">
 <Table><TableHeader><TableRow><TableHead>العميل</TableHead><TableHead>الهاتف</TableHead><TableHead>الوحدة</TableHead><TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
 <TableBody>{d.bookings.map(b=><TableRow key={b.id}><TableCell className="font-bold">{b.customerName}</TableCell><TableCell dir="ltr">{b.customerPhone}</TableCell><TableCell>{d.units.find(u=>u.id===b.unitId)?.unitNumber??"—"}</TableCell><TableCell><StatusBadge status={b.status}/></TableCell><TableCell>{b.bookingDate.toLocaleDateString("ar-EG")}</TableCell></TableRow>)}</TableBody></Table>
 {d.bookings.length===0&&<p className="p-10 text-center text-[#91a39d]">لا توجد حجوزات حتى الآن. ابدأ بحجز وحدة من صفحة المخزون.</p>}
 </Card></>;
}
