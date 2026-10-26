import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {hash} from "bcryptjs";
import postgres from "postgres";

// Isolated CI database only. NEVER run destructive fixtures against production Neon.
const url=process.env.DATABASE_URL_ADMIN;
if(!url||new URL(url).pathname.slice(1)!=="foundation_test")
 throw new Error("Phase 15 direct account tests are restricted to foundation_test");
const db=postgres(url,{max:1,prepare:false});
const token=randomBytes(5).toString("hex");
const pwdHash=await hash("CI-temporary-only-SAFE-password-2026",12);
try{
 await db.begin(async tx=>{
  let [platform]=await tx`SELECT tenant_id FROM public.tenants WHERE is_platform_tenant=true`;
  if(!platform)[platform]=await tx`INSERT INTO public.tenants(name,slug,is_platform_tenant)
    VALUES('CI Platform',${"qa-platform-"+token},true) RETURNING tenant_id`;
  const owner=randomUUID(),ownerMail="platform-"+token+"@example.invalid";
  await tx`INSERT INTO public.users(id,tenant_id,email,full_name,role,external_auth_id,password_hash)
    VALUES(${owner},${platform.tenant_id},${ownerMail},'CI Owner','PLATFORM_OWNER',${"ci:"+owner},${pwdHash})`;
  await tx`SELECT set_config('app.tenant_id',${platform.tenant_id},true)`;
  await tx.unsafe("SET LOCAL ROLE tenant_runtime");
  const [created]=await tx`SELECT * FROM app.platform_create_company_with_admin(
    ${owner}::uuid,'CI New Company',${"company-"+token},
    'Company Administrator',${"admin-"+token+"@example.invalid"},${pwdHash})`;
  assert(created.tenant_id&&created.admin_id,"Company and administrator must be created together");
  const [second]=await tx`SELECT app.platform_create_company_admin(
     ${owner}::uuid,${created.tenant_id}::uuid,'Second Administrator',
     ${"second-"+token+"@example.invalid"},${pwdHash}) AS id`;
  assert(second.id);
  await tx.unsafe("RESET ROLE");
  const [company]=await tx`SELECT name,slug FROM public.tenants WHERE tenant_id=${created.tenant_id}`;
  const [admin]=await tx`SELECT id,role,email,password_hash,tenant_id FROM public.users WHERE id=${created.admin_id}`;
  assert.equal(company.slug,"company-"+token);
  assert.equal(admin.tenant_id,created.tenant_id);
  assert.equal(admin.role,"COMPANY_ADMIN");
  assert(admin.password_hash.startsWith("$2b$12$"));
  const audits=await tx`SELECT entity_type,new_values FROM public.audit_logs
     WHERE entity_id IN (${created.tenant_id},${created.admin_id},${second.id})`;
  assert.equal(audits.length,3);
  assert(audits.every(x=>!JSON.stringify(x.new_values).includes(pwdHash)));

  await tx`SELECT set_config('app.tenant_id',${created.tenant_id},true)`;
  await tx.unsafe("SET LOCAL ROLE tenant_runtime");
  const [employee]=await tx`SELECT app.company_create_employee(
    ${created.admin_id}::uuid,'Sales Employee',${"sales-"+token+"@example.invalid"},
    'SALES'::public.app_user_role,${pwdHash}) AS id`;
  assert(employee.id);

  // Even a COMPANY_ADMIN cannot create a PLATFORM_OWNER account.
  await assert.rejects(()=>tx.savepoint(async sp=>sp`SELECT app.company_create_employee(
    ${created.admin_id}::uuid,'Unprivileged Owner',${"nope-"+token+"@example.invalid"},
    'PLATFORM_OWNER'::public.app_user_role,${pwdHash})`));
  // A SALES member cannot add employees or create companies.
  await assert.rejects(()=>tx.savepoint(async sp=>sp`SELECT app.company_create_employee(
    ${employee.id}::uuid,'Forbidden Sales',
    ${"nope2-"+token+"@example.invalid"},'SALES'::public.app_user_role,${pwdHash})`));
  await assert.rejects(()=>tx.savepoint(async sp=>sp`SELECT app.platform_create_company_admin(
    ${created.admin_id}::uuid,${created.tenant_id}::uuid,'Not Platform',
    ${"nope3-"+token+"@example.invalid"},${pwdHash})`));
  // Direct user inserts are not exposed to the business runtime.
  await assert.rejects(()=>tx.savepoint(async sp=>sp`INSERT INTO public.users(
    tenant_id,email,full_name,role,password_hash) VALUES(
    ${created.tenant_id},${"unmanaged-"+token+"@example.invalid"},'Unmanaged','SALES',${pwdHash})`));
  // Invitation RPC must remain disabled.
  await assert.rejects(()=>tx.savepoint(async sp=>sp`SELECT app.create_invitation(
    ${created.admin_id}::uuid,${"blocked-"+token+"@example.invalid"},
    'SALES'::public.app_user_role,${"a".repeat(64)},now()+interval '1 day')`));
  await tx.unsafe("RESET ROLE");

  const [added]=await tx`SELECT id,role,tenant_id FROM public.users WHERE id=${employee.id}`;
  assert.equal(added.role,"SALES");assert.equal(added.tenant_id,created.tenant_id);
  await tx`SELECT set_config('app.tenant_id',${platform.tenant_id},true)`;
  await tx.unsafe("SET LOCAL ROLE tenant_runtime");
  await tx`SELECT app.platform_set_tenant_active(${owner}::uuid,${created.tenant_id}::uuid,false)`;
  await tx.unsafe("RESET ROLE");
  const [suspended]=await tx`SELECT is_active FROM public.tenants WHERE tenant_id=${created.tenant_id}`;
  assert.equal(suspended.is_active,false);
 });
 console.log("Phase 15 direct accounts: owner/tenant provisioning, bcrypt, role isolation, audit, no-invite grants, suspend OK");
}finally{await db.end();}
