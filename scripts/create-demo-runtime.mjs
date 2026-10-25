import postgres from "postgres";
const url=process.env.DATABASE_URL_ADMIN;
const name=url?new URL(url).pathname.slice(1):"";
if(!url || !(name==="foundation_test"||name.endsWith("_demo")) ||
   process.env.DEMO_SEED_ALLOW!=="I_ACKNOWLEDGE_DEMO_ONLY")
 throw new Error("Refusing to create role outside explicitly acknowledged demo DB");
const password=process.env.DEMO_RUNTIME_PASSWORD;
if(!password || password.length<24) throw new Error("DEMO_RUNTIME_PASSWORD must be at least 24 chars");
const db=postgres(url,{max:1});
try {
 const role="workspace_demo_runtime";
 const found=await db`SELECT 1 FROM pg_roles WHERE rolname=${role}`;
 if(!found.length) await db.unsafe('CREATE ROLE workspace_demo_runtime LOGIN PASSWORD '+
  "'" + password.replaceAll("'","''") + "' NOBYPASSRLS");
 await db.unsafe("GRANT tenant_runtime TO workspace_demo_runtime");
 console.log("Created restricted demo runtime; do not use admin credentials in web server");
}finally{await db.end();}
