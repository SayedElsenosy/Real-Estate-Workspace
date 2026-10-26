import assert from "node:assert/strict";
import {randomUUID,randomBytes,createHash} from "node:crypto";
import {hash} from "bcryptjs";
import postgres from "postgres";

// This is a destructive-fixture smoke test, restricted to the ephemeral CI database.
const url=process.env.DATABASE_URL_ADMIN;
if(!url||new URL(url).pathname.slice(1)!=="foundation_test")
 throw new Error("Phase 15 security test requires isolated foundation_test database");
const db=postgres(url,{max:1,prepare:false});
try{
 await db.begin(async tx=>{
  let [platform]=await tx`SELECT tenant_id FROM public.tenants WHERE is_platform_tenant=true`;
  if(!platform)[platform]=await tx`INSERT INTO public.tenants(name,slug,is_platform_tenant)
    VALUES('QA Platform',${"qa-platform-"+randomBytes(4).toString("hex")},true) RETURNING tenant_id`;
  const platformActor=randomUUID(), companyActor=randomUUID();
  const baseEmail=randomBytes(6).toString("hex");
  await tx`INSERT INTO public.users(id,tenant_id,email,full_name,role,external_auth_id)
   VALUES(${platformActor},${platform.tenant_id},${"qa-owner-"+baseEmail+"@example.invalid"},'QA Owner','PLATFORM_OWNER',${"qa:"+platformActor})`;
  await tx`SELECT set_config('app.tenant_id',${platform.tenant_id},true)`;
  await tx.unsafe("SET LOCAL ROLE tenant_runtime");
  const [newCompany]=await tx`SELECT * FROM app.platform_create_tenant(${platformActor}::uuid,
   'QA Company',${"qa-"+baseEmail})`;
  const listed=await tx`SELECT * FROM app.platform_tenants(${platformActor}::uuid)`;
  assert(listed.some(x=>x.tenant_id===newCompany.tenant_id&&x.is_active));
  await tx.unsafe("RESET ROLE");

  await tx`INSERT INTO public.users(id,tenant_id,email,full_name,role,external_auth_id)
   VALUES(${companyActor},${newCompany.tenant_id},${"qa-admin-"+baseEmail+"@example.invalid"},'QA Admin','COMPANY_ADMIN',${"qa:"+companyActor})`;
  await tx`SELECT set_config('app.tenant_id',${newCompany.tenant_id},true)`;
  const token=randomBytes(32).toString("hex"),digest=createHash("sha256").update(token).digest("hex");
  const invitedEmail="qa-invited-"+baseEmail+"@example.invalid",exp=new Date(Date.now()+3600000);
  await tx.unsafe("SET LOCAL ROLE tenant_runtime");
  const [invite]=await tx`SELECT app.create_invitation(${companyActor}::uuid,${invitedEmail},
   'SALES'::public.app_user_role,${digest},${exp}::timestamptz) AS id`;
  assert(invite.id);
  await tx.unsafe("RESET ROLE");

  const passwordHash=await hash("QA-only-safepassword-2026",12);
  await tx.unsafe("SET LOCAL ROLE auth_runtime");
  const before=await tx`SELECT * FROM app.invitation_preview(${digest})`;
  assert.equal(before.length,1);
  const [created]=await tx`SELECT app.accept_invitation(${digest},'Invited QA Employee',${passwordHash}) AS id`;
  assert(created.id);
  const after=await tx`SELECT * FROM app.invitation_preview(${digest})`;
  assert.equal(after.length,0,"Accepted invitation must not be reusable");
  await tx.unsafe("RESET ROLE");

  const [row]=await tx`SELECT email,role,password_hash,tenant_id FROM public.users WHERE id=${created.id}`;
  assert.equal(row.email,invitedEmail);
  assert.equal(row.tenant_id,newCompany.tenant_id);
  assert.equal(row.role,"SALES");
  assert(row.password_hash.startsWith("$2b$12$"),"Password requires bcrypt-12 hash");

  await tx`SELECT set_config('app.tenant_id',${platform.tenant_id},true)`;
  await tx.unsafe("SET LOCAL ROLE tenant_runtime");
  await tx`SELECT app.platform_set_tenant_active(${platformActor}::uuid,${newCompany.tenant_id}::uuid,false)`;
  await tx.unsafe("RESET ROLE");
  const [suspended]=await tx`SELECT is_active FROM public.tenants WHERE tenant_id=${newCompany.tenant_id}`;
  assert.equal(suspended.is_active,false);
 });
 console.log("Phase 15 smoke: owner functions, RLS runtime roles, invitations, single-use acceptance, suspension OK");
}finally{await db.end();}
