import {businessDate} from "@/lib/utils/date";
import {loadWorkspace} from "@/lib/workspace/server-data";
import {PageHeader} from "@/components/workspace/page-header";
import {Card} from "@/components/ui/card";
import {Table,TableHeader,TableRow,TableHead,TableBody,TableCell} from "@/components/ui/table";
import {money} from "@/lib/utils";
import Decimal from "decimal.js";
import {PendingCheques} from "@/components/workspace/pending-cheques";
const methods:Record<string,string>={CASH:"نقدي",BANK_TRANSFER:"تحويل بنكي",CHEQUE:"شيك"};
export default async function TreasuryPage(){
 const d=await loadWorkspace();
 const today=businessDate(new Date());
 const todayTotal=d.receipts.filter(r=>r.receiptDate===today&&r.chequeClearanceStatus==="CLEARED").reduce((sum,r)=>sum.plus(r.amount),new Decimal(0));
 const unpaidOverdue=d.installments.filter(i=>i.status==="OVERDUE"||(i.status==="PENDING"&&i.dueDate<today)).reduce((sum,i)=>sum.plus(i.amount),new Decimal(0));
 const pending=d.receipts.filter(r=>r.method==="CHEQUE"&&r.chequeClearanceStatus==="PENDING").map(r=>{
  const contract=d.contracts.find(c=>c.id===r.contractId);
  const booking=d.bookings.find(b=>b.id===contract?.bookingId);
  return {id:r.id,amount:r.amount,referenceNumber:r.referenceNumber,customer:booking?.customerName||"—",receiptDate:r.receiptDate};
 });
 const chequeRecorded=d.receipts.filter(r=>r.method==="CHEQUE"&&r.chequeClearanceStatus==="PENDING").reduce((sum,r)=>sum.plus(r.amount),new Decimal(0));
 return <><PageHeader eyebrow="المالية / TREASURY" title="لوحة الخزينة" description="مؤشرات مبنية على إيصالات وأقساط حقيقية."/>
 <div className="mb-6 grid gap-4 md:grid-cols-3">
 <Card className="p-5"><p>المقبوضات المسجلة اليوم</p><strong>{money(todayTotal.toFixed(2))}</strong></Card>
 <Card className="p-5"><p>الشيكات المعلقة تحت التحصيل</p><strong>{money(chequeRecorded.toFixed(2))}</strong><p className="text-xs text-amber-700">يعرض فقط الشيكات المسجلة بحالة PENDING؛ الشيكات القديمة غير المصنفة مستبعدة.</p></Card>
 <Card className="p-5"><p>الأقساط غير المدفوعة والمتأخرة</p><strong>{money(unpaidOverdue.toFixed(2))}</strong></Card></div>
 <Card className="overflow-hidden"><Table><TableHeader><TableRow><TableHead>رقم الإيصال</TableHead><TableHead>القيمة</TableHead><TableHead>طريقة الدفع</TableHead><TableHead>رقم العقد</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
 <TableBody>{d.receipts.map(r=><TableRow key={r.id}><TableCell>{r.id.slice(0,8).toUpperCase()}</TableCell><TableCell>{money(r.amount)}</TableCell><TableCell>{methods[r.method]}</TableCell><TableCell>{r.contractId.slice(0,8).toUpperCase()}</TableCell><TableCell>{r.receiptDate}</TableCell></TableRow>)}</TableBody></Table></Card><PendingCheques initial={pending}/>
 <p className="mt-4 text-sm text-amber-700">تنبيه: تسجيل إيصال بشيك لا يثبت تحصيل قيمته في البنك. دورة تسوية الشيكات والمرتجعات غير منفذة.</p></>;
}
