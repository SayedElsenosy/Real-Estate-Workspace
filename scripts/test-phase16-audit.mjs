import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import postgres from "postgres";
const url=process.env.DATABASE_URL_ADMIN;
if(!url||new URL(url).pathname.slice(1)!=="foundation_test")throw new Error("Audit tests restricted to isolated foundation_test database");
const db=postgres(url,{max:1,prepare:false});
try{
 await db.begin(async tx=>{
  const tenant=randomUUID(),actor=randomUUID(),email="audit-"+randomBytes(6).toString("hex")+"@example.invalid";
  await tx`INSERT INTO public.tenants(tenant_id,name,slug) VALUES(${tenant},'Audit Test',${"audit-"+tenant.slice(0,8)})`;
  await tx`INSERT INTO public.users(id,tenant_id,email,full_name,role,external_auth_id) VALUES(${actor},${tenant},${email},'Audit Manager','COMPANY_ADMIN',${"test:"+actor})`;
  await tx.unsafe("SET LOCAL ROLE tenant_runtime");
  await tx`SELECT set_config('app.tenant_id',${tenant},true)`;
  await tx`SELECT set_config('app.actor_id',${actor},true)`;
  const [project]=await tx`INSERT INTO public.projects(tenant_id,name,location,status) VALUES(${tenant},'Audited','Cairo','ACTIVE') RETURNING id`;
  await tx`UPDATE public.projects SET location='Zayed' WHERE id=${project.id}`;
  const items=await tx`SELECT action,entity_type,user_id,old_values,new_values
     FROM public.audit_logs WHERE entity_id=${project.id} ORDER BY created_at,id`;
  assert.equal(items.length,2);
  assert(items.some(x=>x.action==="INSERT"&&x.old_values===null));
  assert(items.some(x=>x.action==="UPDATE"&&x.old_values.location==="Cairo"&&x.new_values.location==="Zayed"));
  assert(items.every(x=>x.user_id===actor));
  const [counts]=await tx`SELECT count(*)::int AS c FROM public.audit_logs WHERE tenant_id=${tenant}`;
  assert(counts.c>=2);


  const [customer]=await tx`INSERT INTO public.customers(tenant_id,full_name,phone_primary,email,national_id)
    VALUES(${tenant},'Private Customer','01112345678','hidden@example.invalid','12345678900000') RETURNING id`;
  const [customerEvent]=await tx`SELECT new_values FROM public.audit_logs
    WHERE entity_type='customers' AND entity_id=${customer.id} AND action='INSERT'`;
  assert(customerEvent,"Customer writes must be audited");
  for(const secret of ['phone_primary','phone_secondary','national_id','email']){
    assert.equal(customerEvent.new_values[secret],undefined,"Audit must redact "+secret);
  }
  const [outside]=await tx`SELECT tenant_id FROM public.tenants WHERE tenant_id<>${tenant} ORDER BY created_at LIMIT 1`;
  if(outside){
    await tx`SELECT set_config('app.tenant_id',${outside.tenant_id},true)`;
    const [cross]=await tx`SELECT count(*)::int AS n FROM public.audit_logs WHERE tenant_id=${tenant}`;
    assert.equal(cross.n,0,"RLS must not expose another tenant's audit");
    await tx`SELECT set_config('app.tenant_id',${tenant},true)`;
  }

  // Runtime role cannot directly forge append-only audit rows.
  try{
   await tx.savepoint(async sp=>sp`UPDATE public.audit_logs SET action='DELETE' WHERE entity_id=${project.id}`);
   throw new Error("Audit UPDATE unexpectedly allowed");
  }catch(error){
   if(error instanceof Error&&error.message==="Audit UPDATE unexpectedly allowed")throw error;
  }
  await tx.unsafe("RESET ROLE");
 });
 console.log("Phase 16 audit: trigger attribution, INSERT/UPDATE diffs, tenant RLS and write restriction verified");
}finally{await db.end();}
