import { loadWorkspace } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { Card } from "@/components/ui/card";
import { Table,TableHeader,TableRow,TableHead,TableBody,TableCell } from "@/components/ui/table";
import { money } from "@/lib/utils";
const methods:Record<string,string>={CASH:"نقدي",BANK_TRANSFER:"تحويل بنكي",CHEQUE:"شيك"};
export default async function TreasuryPage(){
 const d=await loadWorkspace();
 return <><PageHeader eyebrow="المالية / TREASURY" title="الخزينة والمقبوضات" description="المقبوضات المسجلة حسب العقد وطريقة الدفع، بدون بيانات وهمية."/><Card className="overflow-hidden">
 <Table><TableHeader><TableRow><TableHead>رقم الإيصال</TableHead><TableHead>القيمة</TableHead><TableHead>طريقة الدفع</TableHead><TableHead>رقم العقد</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
 <TableBody>{d.receipts.map(r=><TableRow key={r.id}><TableCell><span dir="ltr">{r.id.slice(0,8).toUpperCase()}</span></TableCell><TableCell><span dir="ltr" className="inline-block">{money(r.amount)}</span></TableCell><TableCell>{methods[r.method]}</TableCell><TableCell><span dir="ltr">{r.contractId.slice(0,8).toUpperCase()}</span></TableCell><TableCell>{r.receiptDate}</TableCell></TableRow>)}</TableBody></Table>
 {d.receipts.length===0&&<p className="p-10 text-center text-[#91a39d]">لا توجد مقبوضات حتى الآن.</p>}
 </Card><p className="mt-4 text-xs text-[#9aaba6]">تنبيه: تسوية الشيكات البنكية والشيكات المرتدة ليست مفعلة بعد.</p></>;
}
