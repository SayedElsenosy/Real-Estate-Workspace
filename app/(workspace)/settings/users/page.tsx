import {getServerI18n} from "@/lib/i18n/server";
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
 const {t,locale}=await getServerI18n();
 return <>
  <PageHeader eyebrow="الإعدادات / STAFF" title={t("pages.settingsUsers")}
   description={locale==="ar"?"إنشاء حسابات الموظفين وتحديد أدوارهم مباشرة دون دعوات.":"Create staff accounts and assign roles directly, without invitations."}/>
  <CompanyUserManager employees={data}/>
 </>;
}
