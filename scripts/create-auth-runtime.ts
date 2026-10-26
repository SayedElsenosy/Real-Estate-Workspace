import postgres from "postgres";
async function main() {
 const url=process.env.DATABASE_URL_ADMIN;
 const password=process.env.AUTH_RUNTIME_PASSWORD;
 if (!url || !password || password.length<24) throw new Error("DATABASE_URL_ADMIN and AUTH_RUNTIME_PASSWORD (24+ chars) required");
 const db=postgres(url,{max:1});
 try {
  const exists=await db`SELECT 1 FROM pg_roles WHERE rolname='workspace_auth_runtime'`;
  if (exists.length) throw new Error("workspace_auth_runtime exists; this script never rotates credentials implicitly");
  await db.unsafe("CREATE ROLE workspace_auth_runtime LOGIN NOBYPASSRLS PASSWORD '"+password.replaceAll("'","''")+"'");
  await db`GRANT auth_runtime TO workspace_auth_runtime`;
  console.log("Created identity-only auth login; use it in AUTH_DATABASE_URL.");
 } finally {await db.end();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Provisioning failed");process.exitCode=1;});
