import "server-only";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { sql, and, eq } from "drizzle-orm";
import { getVerifiedWorkspaceSession } from "@/lib/workspace/server-data";
import { withTenantTransaction } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export type CompanyRole = "COMPANY_ADMIN" | "SALES" | "ACCOUNTANT";
export type ManagedAccount = { fullName:string;email:string;password:string };

function validateAccount(input:ManagedAccount) {
 const fullName=input.fullName?.trim(), email=input.email?.trim().toLowerCase(), password=input.password;
 if(!fullName||fullName.length<2||fullName.length>200)throw new Error("INVALID_NAME");
 if(!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("INVALID_EMAIL");
 if(typeof password!=="string"||password.length<12||Buffer.byteLength(password,"utf8")>72)
   throw new Error("INVALID_PASSWORD");
 return {fullName,email,password};
}
export async function platformSession() {
 const identity=await getVerifiedWorkspaceSession();
 if(identity.role!=="PLATFORM_OWNER")throw new Error("FORBIDDEN");
 return identity;
}
export async function companyAdminSession() {
 const identity=await getVerifiedWorkspaceSession();
 if(identity.role!=="COMPANY_ADMIN")throw new Error("FORBIDDEN");
 return identity;
}
export async function listPlatformTenants() {
 const identity=await platformSession();
 return withTenantTransaction(identity.tenantId,tx=>tx.execute<{
  tenant_id:string;name:string;slug:string;is_active:boolean;users_count:string;projects_count:string;
 }>(sql`select * from app.platform_tenants(${identity.id}::uuid)`),identity.id);
}
/** Atomic creation: no company without its initial authenticated Company Admin. */
export async function createPlatformTenant(name:string,admin:ManagedAccount) {
 const identity=await platformSession();
 const company=name?.trim();
 if(!company||company.length<2||company.length>200)throw new Error("INVALID_COMPANY");
 const {fullName,email,password}=validateAccount(admin);
 const stem=company.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,32)||"company";
 const slug=stem+"-"+randomBytes(5).toString("hex");
 const passwordHash=await hash(password,12);
 const rows=await withTenantTransaction(identity.tenantId,tx=>tx.execute<{
  tenant_id:string;slug:string;admin_id:string;
 }>(sql`select * from app.platform_create_company_with_admin(
   ${identity.id}::uuid,${company},${slug},${fullName},${email},${passwordHash}
 )`),identity.id);
 return rows[0];
}
/** Platform owner may also create additional company admins for existing tenants. */
export async function createPlatformCompanyAdmin(tenantId:string,admin:ManagedAccount) {
 const identity=await platformSession();
 const {fullName,email,password}=validateAccount(admin);
 const passwordHash=await hash(password,12);
 const [row]=await withTenantTransaction(identity.tenantId,tx=>tx.execute<{id:string}>(
  sql`select app.platform_create_company_admin(
  ${identity.id}::uuid,${tenantId}::uuid,${fullName},${email},${passwordHash}) as id`),identity.id);
 return row.id;
}
export async function changeTenantStatus(tenantId:string,isActive:boolean) {
 const identity=await platformSession();
 return withTenantTransaction(identity.tenantId,tx=>tx.execute(
  sql`select app.platform_set_tenant_active(${identity.id}::uuid,${tenantId}::uuid,${isActive})`),identity.id);
}
export async function listCompanyUsers() {
 const identity=await companyAdminSession();
 return withTenantTransaction(identity.tenantId,tx=>tx.select({
   id:users.id,email:users.email,fullName:users.fullName,role:users.role,isActive:users.isActive,
  }).from(users).where(and(eq(users.tenantId,identity.tenantId))).orderBy(users.fullName,users.id),identity.id);
}
export async function createCompanyEmployee(account:ManagedAccount,role:CompanyRole) {
 const identity=await companyAdminSession();
 if(!["COMPANY_ADMIN","SALES","ACCOUNTANT"].includes(role))throw new Error("INVALID_ROLE");
 const {fullName,email,password}=validateAccount(account);
 const passwordHash=await hash(password,12);
 const [row]=await withTenantTransaction(identity.tenantId,tx=>tx.execute<{id:string}>(
  sql`select app.company_create_employee(
   ${identity.id}::uuid,${fullName},${email},${role}::public.app_user_role,${passwordHash}) as id`
 ),identity.id);
 return row.id;
}
