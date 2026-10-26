import {useTranslations} from "next-intl";
"use client";
import {useEffect,useState} from "react";
import {Table,TableHeader,TableRow,TableHead,TableBody,TableCell} from "@/components/ui/table";
import {StatusBadge} from "@/components/workspace/status-badge";
import {RecordPaymentDialog} from "@/components/workspace/record-payment-dialog";
import {money} from "@/lib/utils";
type Installment={id:string;sequence:number;dueDate:string;amount:string;status:"PENDING"|"PAID"|"OVERDUE"};
export function InstallmentsTable({contractId,initial,canPay}:{contractId:string;initial:Installment[];canPay:boolean}){
 const t=useTranslations("ui");
 const [rows,setRows]=useState(initial);
 useEffect(()=>setRows(initial),[initial]);
 return <Table><TableHeader><TableRow><TableHead>{t("installmentNo")}</TableHead><TableHead>{t("dueDate")}</TableHead><TableHead>{t("installmentAmount")}</TableHead><TableHead>{t("statusLabel")}</TableHead><TableHead>{t("actionsLabel")}</TableHead></TableRow></TableHeader>
 <TableBody>{rows.map(i=><TableRow key={i.id} data-testid={`installment-${i.sequence}`}>
 <TableCell>{i.sequence}</TableCell><TableCell>{i.dueDate}</TableCell><TableCell>{money(i.amount)}</TableCell><TableCell><StatusBadge status={i.status}/></TableCell>
 <TableCell>{canPay&&(i.status==="PENDING"||i.status==="OVERDUE")?<RecordPaymentDialog contractId={contractId} installmentId={i.id} amount={i.amount} onPaid={()=>setRows(current=>current.map(row=>row.id===i.id?{...row,status:"PAID"}:row))}/>:null}</TableCell>
 </TableRow>)}</TableBody></Table>;
}
