import Link from "next/link";
import { loadWorkspace, type WorkspaceListQuery } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { PaginationNav, TableSearch } from "@/components/workspace/pagination-nav";
import { Card } from "@/components/ui/card";
import { Table,TableHeader,TableRow,TableHead,TableBody,TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/workspace/status-badge";
import { money } from "@/lib/utils";
export default async function ContractsPage({searchParams}:{searchParams:Promise<Omit<WorkspaceListQuery,"resource">>}) {
  const d=await loadWorkspace({...await searchParams,resource:"contracts"});
  if(d.resource!=="contracts") throw new Error("Unexpected contracts query");
  return <><PageHeader eyebrow="العقود / CONTRACTS" title="العقود والأقساط" description="العقود وجدول السداد المرتبط بها"/>
    <div className="mb-4"><TableSearch path="/contracts" search={d.pagination.search} placeholder="اسم العميل أو رقم العقد"/></div>
    <Card className="overflow-hidden"><Table><TableHeader><TableRow><TableHead>العقد</TableHead><TableHead>العميل</TableHead><TableHead>الإجمالي</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
      <TableBody>{d.rows.map(c=><TableRow key={c.id}>
        <TableCell><Link className="text-teal-700 underline" href={"/contracts/"+c.id}>{c.id.slice(0,8).toUpperCase()}</Link></TableCell>
        <TableCell>{c.customerName}</TableCell><TableCell>{money(c.totalAmount)}</TableCell>
        <TableCell><StatusBadge status={c.status}/></TableCell>
      </TableRow>)}</TableBody></Table>
      {!d.rows.length&&<p className="p-8 text-center text-sm text-slate-500">لا توجد عقود مطابقة.</p>}
    </Card><PaginationNav path="/contracts" {...d.pagination}/>
  </>;
}
