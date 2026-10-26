import { notFound } from "next/navigation";
import { getVerifiedWorkspaceSession } from "@/lib/workspace/server-data";
import { listCompanyUsers } from "@/lib/platform/administration";
import { PageHeader } from "@/components/workspace/page-header";
import { CompanyUserManager } from "@/components/admin/company-user-manager";
export const dynamic="force-dynamic";
export default async function CompanyUsersPage(){
 const identity=await getVerifiedWorkspaceSession();
 if(identity.role!=="COMPANY_ADMIN")notFound();
 const data=await listCompanyUsers();
 return <>
  <PageHeader eyebrow="الإعدادات / STAFF" title="إدارة المستخدمين"
   description="عرض أعضاء الشركة وإرسال دعوات إلكترونية لإنشاء الحسابات."/>
  <CompanyUserManager employees={data.employees}
   invitations={data.pending.map(i=>({...i,expiresAt:i.expiresAt.toISOString(),
    usedAt:i.usedAt?.toISOString()??null,revokedAt:i.revokedAt?.toISOString()??null}))}/>
 </>;
}
