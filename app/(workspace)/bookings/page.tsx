import { CancelBookingButton } from "@/components/workspace/cancel-booking-button";
import { businessDate } from "@/lib/utils/date";
import { loadWorkspace, type WorkspaceListQuery } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { PaginationNav, TableSearch } from "@/components/workspace/pagination-nav";
import { Card } from "@/components/ui/card";
import { Table,TableHeader,TableRow,TableHead,TableBody,TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/workspace/status-badge";
import { ContractGeneration } from "@/components/workspace/contract-generation";
export default async function BookingsPage({searchParams}:{searchParams:Promise<Omit<WorkspaceListQuery,"resource">>}) {
  const d=await loadWorkspace({...await searchParams,resource:"bookings"});
  if(d.resource!=="bookings") throw new Error("Unexpected bookings query");
  return <><PageHeader eyebrow="المبيعات / BOOKINGS" title="الحجوزات" description="حجوزات العملاء المسجلة داخل شركتك."/>
    <div className="mb-4"><TableSearch path="/bookings" search={d.pagination.search} placeholder="اسم العميل أو رقم الوحدة"/></div>
    <Card className="overflow-hidden"><Table><TableHeader><TableRow><TableHead>العميل</TableHead><TableHead>الوحدة</TableHead><TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead><TableHead>العقد</TableHead><TableHead>الإجراءات</TableHead></TableRow></TableHeader>
      <TableBody>{d.rows.map(b=><TableRow key={b.id}>
        <TableCell>{b.customerName}</TableCell><TableCell>{b.unitNumber}</TableCell>
        <TableCell><StatusBadge status={b.status}/></TableCell><TableCell>{businessDate(b.bookingDate)}</TableCell>
        <TableCell>{b.status==="CONFIRMED"&&!b.contractId&&d.session.role==="COMPANY_ADMIN"?
          <ContractGeneration bookingId={b.id} totalAmount={b.unitPrice}/>:b.contractId?"عقد صادر":"—"}</TableCell>
        <TableCell>{b.status==="CONFIRMED"&&d.session.role==="COMPANY_ADMIN"?<CancelBookingButton bookingId={b.id}/>:null}</TableCell>
      </TableRow>)}</TableBody></Table>
      {!d.rows.length&&<p className="p-8 text-center text-sm text-slate-500">لا توجد حجوزات مطابقة.</p>}
    </Card><PaginationNav path="/bookings" {...d.pagination}/>
  </>;
}
