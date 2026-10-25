import { loadWorkspace } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { Card } from "@/components/ui/card";
import { Table,TableHeader,TableRow,TableHead,TableBody,TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/workspace/status-badge";
import { money } from "@/lib/utils";
export default async function ContractsPage(){
 const d=await loadWorkspace();
 return <><PageHeader eyebrow="العقود / CONTRACTS" title="العقود والأقساط" description="العقود الفعلية وحالات السداد المسجلة بقاعدة البيانات."/><Card className="overflow-hidden">
 <Table><TableHeader><TableRow><TableHead>رقم العقد</TableHead><TableHead>إجمالي العقد</TableHead><TableHead>عدد الأقساط</TableHead><TableHead>الحالة</TableHead><TableHead>التوقيع</TableHead></TableRow></TableHeader>
 <TableBody>{d.contracts.map(c=><TableRow key={c.id}><TableCell className="font-semibold"><span dir="ltr">{c.id.slice(0,8).toUpperCase()}</span></TableCell><TableCell><span dir="ltr" className="inline-block">{money(c.totalAmount)}</span></TableCell><TableCell>{d.installments.filter(i=>i.contractId===c.id).length}</TableCell><TableCell><StatusBadge status={c.status}/></TableCell><TableCell>{c.signedAt?.toLocaleDateString("ar-EG")??"—"}</TableCell></TableRow>)}</TableBody></Table>
 {d.contracts.length===0&&<p className="p-10 text-center text-[#91a39d]">لا توجد عقود صادرة حتى الآن.</p>}
 </Card></>;
}
