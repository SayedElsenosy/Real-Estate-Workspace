import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import postgres from "postgres";

async function main() {
 const url=process.env.DATABASE_URL_ADMIN;
 const tenantId=process.env.ADMIN_TENANT_ID;
 const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
 const name=process.env.ADMIN_NAME?.trim();
 const password=process.env.ADMIN_PASSWORD;
 if (!url || !tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId) ||
  !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 ||
  !name || !password || password.length<12 || Buffer.byteLength(password,"utf8")>72)
  throw new Error("Set DATABASE_URL_ADMIN, ADMIN_TENANT_ID (existing company), ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD (12+ characters, <=72 UTF-8 bytes)");
 const db=postgres(url,{max:1,prepare:false});
 try {
  const passwordHash=await hash(password,12);
  await db.begin(async tx=>{
   const [tenant]=await tx`SELECT tenant_id FROM public.tenants WHERE tenant_id=${tenantId} AND NOT is_platform_tenant`;
   if (!tenant) throw new Error("Company tenant does not exist; provision the company first");
   // Fail on conflicts: never silently reset an existing account's password/role.
   await tx`INSERT INTO public.users(id,tenant_id,email,full_name,role,external_auth_id,password_hash)
    VALUES(${randomUUID()},${tenantId},${email},${name},'COMPANY_ADMIN',${"credentials:"+randomUUID()},${passwordHash})`;
  });
  console.log("Company Admin created. Credentials were not logged.");
 } finally {await db.end();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Provisioning failed");process.exitCode=1;});
