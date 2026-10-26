import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import postgres from "postgres";
/** Trusted operator-only terminal. NEVER configure DATABASE_URL_ADMIN in Vercel. */
async function main(){
 const url=process.env.DATABASE_URL_ADMIN;
 const email=process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
 const name=process.env.PLATFORM_OWNER_NAME?.trim();
 const password=process.env.PLATFORM_OWNER_PASSWORD;
 if(!url||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||
  !name||name.length>200||!password||password.length<12||Buffer.byteLength(password,"utf8")>72)
  throw new Error("Set DATABASE_URL_ADMIN, PLATFORM_OWNER_EMAIL, PLATFORM_OWNER_NAME, PLATFORM_OWNER_PASSWORD (12+ chars, max 72 UTF-8 bytes)");
 const db=postgres(url,{max:1,prepare:false});
 try{
  const passwordHash=await hash(password,12);
  const id=await db.begin(async tx=>{
   let [tenant]=await tx`SELECT tenant_id FROM public.tenants WHERE is_platform_tenant=true FOR UPDATE`;
   if(!tenant){
    [tenant]=await tx`INSERT INTO public.tenants(name,slug,is_platform_tenant,is_active)
      VALUES('BUNYRA Platform','bunyra-platform',true,true)
      RETURNING tenant_id`;
   }
   const already=await tx`SELECT 1 FROM public.users WHERE tenant_id=${tenant.tenant_id} AND role='PLATFORM_OWNER'`;
   if(already.length)throw new Error("Platform owner already exists; credentials cannot be silently reset");
   const ownerId=randomUUID();
   await tx`INSERT INTO public.users(id,tenant_id,email,full_name,role,external_auth_id,password_hash)
    VALUES(${ownerId},${tenant.tenant_id},${email},${name},'PLATFORM_OWNER',${"credentials:"+randomUUID()},${passwordHash})`;
   return ownerId;
  });
  console.log("Platform owner created:",id,"(credentials not printed)");
 }finally{await db.end();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Provisioning failed");process.exitCode=1;});
