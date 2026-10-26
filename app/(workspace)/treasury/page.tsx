import { getServerI18n } from "@/lib/i18n/server";
import { loadWorkspace, type WorkspaceListQuery } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { PaginationNav, TableSearch } from "@/components/workspace/pagination-nav";
import { Card } from "@/components/ui/card";
import { Table,TableHeader,TableRow,TableHead,TableBody,TableCell } from "@/components/ui/table";
import { money } from "@/lib/utils";
import { PendingCheques } from "@/components/workspace/pending-cheques";
const methods:Record<string,string>={CASH:"نقدي",BANK_TRANSFER:"تحويل بنكي",CHEQUE:"شيك"};
export default async function TreasuryPage({searchParams}:{searchParams:Promise<Omit<WorkspaceListQuery,"resource">>}) {
  const d=await loadWorkspace({...await searchParams,resource:"receipts"});
 const {t}=await getServerI18n();
  if(d.resource!=="receipts") throw new Error("Unexpected treasury query");
  return <><PageHeader eyebrow="المالية / TREASURY" title={t("pages.treasury")} description="مؤشرات مالية شاملة وإيصالات مقسمة إلى صفحات."/>
    <div className="mb-6 grid gap-4 md:grid-cols-3">
      <Card className="p-5"><p>المقبوضات المسجلة اليوم</p><strong>{money(d.treasury.todayTotal)}</strong></Card>
      <Card className="p-5"><p>الشيكات المعلقة تحت التحصيل</p><strong>{money(d.treasury.pendingAmount)}</strong></Card>
      <Card className="p-5"><p>الأقساط غير المدفوعة والمتأخرة</p><strong>{money(d.treasury.overdueAmount)}</strong></Card>
    </div>
    <div className="mb-4"><TableSearch path="/treasury" search={d.pagination.search} placeholder="اسم العميل أو مرجع الإيصال"/></div>
    <Card className="overflow-hidden"><Table><TableHeader><TableRow>
      <TableHead>رقم الإيصال</TableHead><TableHead>القيمة</TableHead><TableHead>طريقة الدفع</TableHead><TableHead>رقم العقد</TableHead><TableHead>التاريخ</TableHead>
    </TableRow></TableHeader><TableBody>{d.rows.map(r=><TableRow key={r.id}>
      <TableCell>{r.id.slice(0,8).toUpperCase()}</TableCell><TableCell>{money(r.amount)}</TableCell>
      <TableCell>{methods[r.method]}</TableCell><TableCell>{r.contractId.slice(0,8).toUpperCase()}</TableCell>
      <TableCell>{r.receiptDate}</TableCell>
    </TableRow>)}</TableBody></Table>
      {!d.rows.length&&<p className="p-8 text-center text-sm text-slate-500">لا توجد إيصالات مطابقة.</p>}
    </Card><PaginationNav path="/treasury" {...d.pagination}/>
    <PendingCheques initial={d.treasury.pendingCheques}/>
    <p className="mt-4 text-xs text-amber-700">قائمة الشيكات المعلقة تعرض أحدث 20 شيكًا؛ الإجمالي المالي يشمل كل الشيكات المعلقة.</p>
  </>;
}
