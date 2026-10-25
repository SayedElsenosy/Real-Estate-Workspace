import {businessDate} from "@/lib/utils/date";
import Decimal from "decimal.js";
import {loadWorkspace} from "@/lib/workspace/server-data";
import {PageHeader} from "@/components/workspace/page-header";
import {Card} from "@/components/ui/card";
import {Table,TableHeader,TableRow,TableHead,TableBody,TableCell} from "@/components/ui/table";
import {money} from "@/lib/utils";
const labels=["1–30 يوم","31–60 يوم","61–90 يوم","أكثر من 90 يوم"];
type Bucket={name:string;amount:Decimal;count:number};
export default async function AgingReport(){
 const d=await loadWorkspace();
 const today=businessDate(new Date());
 const dateOf=(s:string)=>Date.UTC(Number(s.slice(0,4)),Number(s.slice(5,7))-1,Number(s.slice(8,10)));
 const byCustomer=new Map<string,{name:string;amount:Decimal;count:number}>();
 const buckets:Bucket[]=labels.map(name=>({name,amount:new Decimal(0),count:0}));
 for(const installment of d.installments){
  const c=d.contracts.find(c=>c.id===installment.contractId);
  if(!c||c.status!=="ACTIVE"||installment.status==="PAID"||installment.dueDate>=today)continue;
  const days=Math.round((dateOf(today)-dateOf(installment.dueDate))/86400000);
  if(days<1)continue;
  const index=days<=30?0:days<=60?1:days<=90?2:3;
  buckets[index].amount=buckets[index].amount.plus(installment.amount);buckets[index].count++;
  const booking=d.bookings.find(b=>b.id===c.bookingId);
  const customer=d.customers.find(x=>x.id===booking?.customerId);
  const key=customer?.id||"historical:"+booking?.id;
  const existing=byCustomer.get(key)||{name:customer?.fullName||booking?.customerName||"عميل غير معروف",amount:new Decimal(0),count:0};
  existing.amount=existing.amount.plus(installment.amount);existing.count++;byCustomer.set(key,existing);
 }
 const total=buckets.reduce((sum,b)=>sum.plus(b.amount),new Decimal(0));
 return <><PageHeader eyebrow="التقارير / AGING" title="تقرير أعمار المديونيات" description={"الأقساط غير المدفوعة والمتجاوزة تاريخ الاستحقاق حتى "+today}/>
  <div className="mb-5 grid gap-3 md:grid-cols-4">{buckets.map(b=><Card key={b.name} className="p-5"><p className="text-sm text-slate-500">{b.name}</p><strong className="block text-xl">{money(b.amount.toFixed(2))}</strong><p className="text-sm text-slate-500">{b.count} قسط</p></Card>)}</div>
  <Card className="mb-5 p-5"><p>إجمالي المتأخرات</p><strong className="text-2xl">{money(total.toFixed(2))}</strong></Card>
  <Card className="overflow-hidden"><h2 className="p-5 text-lg font-bold">إجمالي المبالغ المتأخرة لكل عميل</h2><Table><TableHeader><TableRow><TableHead>العميل</TableHead><TableHead>الأقساط المتأخرة</TableHead><TableHead>قيمة المتأخرات</TableHead></TableRow></TableHeader><TableBody>{Array.from(byCustomer.values()).sort((a,b)=>b.amount.comparedTo(a.amount)).map((c,i)=><TableRow key={i}><TableCell>{c.name}</TableCell><TableCell>{c.count}</TableCell><TableCell>{money(c.amount.toFixed(2))}</TableCell></TableRow>)}</TableBody></Table>
  {!byCustomer.size&&<p className="p-5 text-sm text-slate-500">لا توجد مديونيات متأخرة.</p>}</Card>
  <p className="mt-4 text-xs text-slate-500">يعتمد التقرير على تاريخ الاستحقاق، ويشمل أقساط PENDING المتأخرة زمنيًا وأقساط OVERDUE. لا يشمل العقود الملغاة.</p></>;
}
