import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
const url=process.env.TEST_DATABASE_URL_ADMIN;
if(!url || new URL(url).pathname!=="/foundation_test") throw new Error("Requires disposable foundation_test");
const db=postgres(url,{max:1});const rollback=new Error("rollback");
try {
 try {await db.begin(async tx=>{
  const t=randomUUID(),u=randomUUID(),email=randomUUID()+"@example.invalid";
  await tx`INSERT INTO tenants(tenant_id,name,slug) VALUES(${t},'Auth RLS',${'auth-'+t})`;
  await tx`INSERT INTO users(id,tenant_id,email,full_name,role,external_auth_id,password_hash)
   VALUES(${u},${t},${email},'Auth RLS','COMPANY_ADMIN',${u},'test-only-hash')`;
  const [{auth_version:before}]=await tx`SELECT auth_version FROM users WHERE id=${u}`;
  await tx`UPDATE users SET password_hash='changed-hash' WHERE id=${u}`;
  assert.equal((await tx`SELECT auth_version FROM users WHERE id=${u}`)[0].auth_version,before+1);
  await tx`SET LOCAL ROLE tenant_runtime`;
  await tx`SELECT set_config('app.tenant_id',${t},true)`;
  const [permissions]=await tx`SELECT has_column_privilege(current_user,'users','password_hash','SELECT') AS hash,
   has_table_privilege(current_user,'accounts','SELECT') AS accounts`;
  assert.equal(permissions.hash,false);assert.equal(permissions.accounts,false);
  assert.equal((await tx`SELECT id FROM users WHERE id=${u}`).length,1);
  await tx`RESET ROLE`;
  await tx`SET LOCAL ROLE auth_runtime`;
  assert.equal((await tx`SELECT id FROM users WHERE lower(email)=${email}`).length,1);
  for(const table of ['bookings','contracts','receipts','units']) {
   assert.equal((await tx`SELECT has_table_privilege(current_user,${table},'SELECT') AS allowed`)[0].allowed,false);
  }
  assert.equal((await tx`SELECT has_table_privilege(current_user,'users','UPDATE') AS allowed`)[0].allowed,false);
  await tx`RESET ROLE`;
  // Case-insensitive unique email across credential-enabled identities, even in other tenants.
  await assert.rejects(tx.savepoint(async sub=>{
   await sub`INSERT INTO users(tenant_id,email,full_name,role,external_auth_id,password_hash)
    VALUES(${t},${email.toUpperCase()},'Duplicate','SALES',${randomUUID()},'test-hash')`;
  }),{code:'23505'});
  throw rollback;
 });} catch(error){if(error!==rollback)throw error;}
 console.log("PASS auth: private hashes, isolated auth/runtime privileges, password revokes sessions, unique credential email");
}finally{await db.end();}
