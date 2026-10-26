import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { sql, and, eq, desc } from "drizzle-orm";
import { getVerifiedWorkspaceSession } from "@/lib/workspace/server-data";
import { withTenantTransaction } from "@/lib/db/client";
import { invitations, users } from "@/lib/db/schema";

export type InviteRole="COMPANY_ADMIN"|"SALES"|"ACCOUNTANT";
export function normalizeEmail(email:string) {
 const e=email.trim().toLowerCase();
 if(e.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("INVALID_EMAIL");
 return e;
}
export async function platformSession() {
 const identity=await getVerifiedWorkspaceSession();
 if(identity.role!=="PLATFORM_OWNER") throw new Error("FORBIDDEN");
 return identity;
}
export async function companyAdminSession() {
 const identity=await getVerifiedWorkspaceSession();
 if(identity.role!=="COMPANY_ADMIN") throw new Error("FORBIDDEN");
 return identity;
}
export async function listPlatformTenants() {
 const identity=await platformSession();
 return withTenantTransaction(identity.tenantId,tx=>tx.execute<{
  tenant_id:string;name:string;slug:string;is_active:boolean;users_count:string;projects_count:string
 }>(sql`select * from app.platform_tenants(${identity.id}::uuid)`));
}
export async function createPlatformTenant(name:string) {
 const identity=await platformSession();
 const cleaned=name.trim();
 if(cleaned.length<2||cleaned.length>200) throw new Error("INVALID_COMPANY");
 const stem=cleaned.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,32)||"company";
 const slug=stem+"-"+randomBytes(5).toString("hex");
 const rows=await withTenantTransaction(identity.tenantId,tx=>tx.execute<{tenant_id:string;slug:string}>(
  sql`select * from app.platform_create_tenant(${identity.id}::uuid,${cleaned},${slug})`));
 return rows[0];
}
export async function changeTenantStatus(tenantId:string,isActive:boolean) {
 const identity=await platformSession();
 return withTenantTransaction(identity.tenantId,tx=>tx.execute(
  sql`select app.platform_set_tenant_active(${identity.id}::uuid,${tenantId}::uuid,${isActive})`));
}
export async function listCompanyUsers() {
 const identity=await companyAdminSession();
 return withTenantTransaction(identity.tenantId,async tx=>{
  const [employees,pending]=await Promise.all([
   tx.select({id:users.id,email:users.email,fullName:users.fullName,role:users.role,isActive:users.isActive})
     .from(users).where(eq(users.tenantId,identity.tenantId)).orderBy(users.fullName,users.id),
   tx.select({id:invitations.id,email:invitations.email,role:invitations.role,
     expiresAt:invitations.expiresAt,usedAt:invitations.usedAt,revokedAt:invitations.revokedAt})
     .from(invitations).where(eq(invitations.tenantId,identity.tenantId))
     .orderBy(desc(invitations.createdAt)).limit(100),
  ]);
  return {employees,pending};
 });
}
export async function createInvitation(email:string,role:InviteRole) {
 const identity=await companyAdminSession();
 const normalized=normalizeEmail(email);
 if(!["COMPANY_ADMIN","SALES","ACCOUNTANT"].includes(role)) throw new Error("INVALID_ROLE");
 const token=randomBytes(32).toString("hex");
 const digest=createHash("sha256").update(token).digest("hex");
 const expires=new Date(Date.now()+72*60*60*1000);
 const rows=await withTenantTransaction(identity.tenantId,tx=>tx.execute<{id:string}>(
  sql`select app.create_invitation(${identity.id}::uuid,${normalized},
     ${role}::public.app_user_role,${digest},${expires}::timestamptz) as id`));
 return {id:rows[0].id,token,email:normalized,companyName:identity.companyName};
}
export async function revokeInvitation(invitationId:string) {
 const identity=await companyAdminSession();
 return withTenantTransaction(identity.tenantId,tx=>tx.execute(
  sql`select app.revoke_invitation(${identity.id}::uuid,${invitationId}::uuid)`));
}
export async function sendInvitationEmail({token,email,companyName}:{
 token:string;email:string;companyName:string;
}) {
 const key=process.env.RESEND_API_KEY,from=process.env.INVITATION_FROM_EMAIL;
 const origin=process.env.AUTH_URL;
 if(!key||!from||!origin||!origin.startsWith("https://"))
   throw new Error("EMAIL_NOT_CONFIGURED");
 const link=new URL("/invite/"+token,origin).toString();
 const escapeHtml=(v:string)=>v.replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
 }[c]??c));
 const response=await fetch("https://api.resend.com/emails",{
  method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
  body:JSON.stringify({
   from,to:[email],subject:"دعوتك للانضمام إلى BUNYRA",
   html:"<div dir='rtl'><h2>دعوة للانضمام إلى "+escapeHtml(companyName)+
     "</h2><p>استخدم الرابط التالي لإنشاء كلمة المرور لحسابك. ينتهي خلال 72 ساعة.</p>"+
     "<p><a href='"+escapeHtml(link)+"'>قبول الدعوة</a></p>"+
     "<p>إذا لم تتوقع هذه الدعوة يمكنك تجاهل الرسالة.</p></div>",
  }),cache:"no-store",
 });
 if(!response.ok) throw new Error("EMAIL_SEND_FAILED");
}
