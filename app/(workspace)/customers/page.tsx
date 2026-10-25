import Link from "next/link";
import { Search, UserRound } from "lucide-react";
import { loadWorkspace } from "@/lib/workspace/server-data";
import { PageHeader } from "@/components/workspace/page-header";
import { Card } from "@/components/ui/card";
import { Table,TableHeader,TableRow,TableHead,TableBody,TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CustomersSearch } from "@/components/workspace/customers-search";
export default async function CustomersPage(){
 const data=await loadWorkspace();
 return <><PageHeader eyebrow="العملاء / CRM" title="العملاء" description="سجل موحد للعملاء والحجوزات والعقود مرتبط بالشركة."/>
 <CustomersSearch customers={data.customers.map(c=>({id:c.id,fullName:c.fullName,phonePrimary:c.phonePrimary,phoneSecondary:c.phoneSecondary,email:c.email}))}/>
 </>;
}
