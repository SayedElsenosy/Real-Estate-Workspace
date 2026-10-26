import { createHmac } from "node:crypto";
import { compare } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { getAuthDatabase } from "@/lib/db/auth-client";
import { authUsers } from "@/lib/db/auth-schema";
import { tenants } from "@/lib/db/schema";

// Valid cost-12 hash used for constant-cost rejection of unknown identities.
const DUMMY_HASH = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
export async function authorizeCredentials(credentials: Partial<Record<string, unknown>>) {
 const email=typeof credentials.email==="string"?credentials.email.trim().toLowerCase():"";
 const password=credentials.password;
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 ||
  typeof password!=="string" || !password || Buffer.byteLength(password,"utf8")>72) return null;
 const db=getAuthDatabase();
 const secret=process.env.AUTH_SECRET;
 if (!secret || secret.length<32) throw new Error("AUTH_SECRET must contain at least 32 characters");
 const key=createHmac("sha256",secret).update(email).digest("hex");
 const attempt=await db.execute<{attempts:number}>(sql`
  INSERT INTO public.auth_login_attempts(key,window_start,attempts) VALUES(${key},now(),1)
  ON CONFLICT(key) DO UPDATE SET
   attempts=CASE WHEN auth_login_attempts.window_start < now()-interval '15 minutes'
    THEN 1 ELSE LEAST(auth_login_attempts.attempts+1,11) END,
   window_start=CASE WHEN auth_login_attempts.window_start < now()-interval '15 minutes'
    THEN now() ELSE auth_login_attempts.window_start END
  RETURNING attempts`);
 if (attempt[0].attempts>10) return null;
 const rows=await db.select({user:authUsers,companyName:tenants.name,tenantActive:tenants.isActive}).from(authUsers)
  .innerJoin(tenants,eq(authUsers.tenantId,tenants.tenantId))
  .where(sql`lower(btrim(${authUsers.email}))=${email} AND ${authUsers.passwordHash} IS NOT NULL`).limit(2);
 const found=rows.length===1?rows[0]:undefined;
 const valid=await compare(password,found?.user.passwordHash??DUMMY_HASH);
 if (!found || !valid || !found.tenantActive || !found.user.isActive || !found.user.externalAuthId) return null;
 const {user,companyName}=found;
 return { id:user.id,name:user.name,email:user.email,tenantId:user.tenantId,role:user.role,
  externalAuthId:user.externalAuthId!,companyName,authVersion:user.authVersion };
}
export async function currentAuthUser(id:string) {
 const [row]=await getAuthDatabase().select({user:authUsers,companyName:tenants.name})
  .from(authUsers).innerJoin(tenants,eq(authUsers.tenantId,tenants.tenantId))
  .where(eq(authUsers.id,id)).limit(1);
 return row;
}
