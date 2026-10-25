import "server-only";
import {and,eq} from "drizzle-orm";
import {verifyRequestIdentity} from "@/lib/auth/mock-session";
import {withTenantTransaction} from "@/lib/db/client";
import {users} from "@/lib/db/schema";
export async function templateAuth(req:Request,roles:string[]=["COMPANY_ADMIN"]){
 let identity:Awaited<ReturnType<typeof verifyRequestIdentity>>;
 try{identity=await verifyRequestIdentity(req);}catch{return {error:"المصادقة غير مجهزة",status:503} as const;}
 if(!identity)return {error:"يلزم تسجيل الدخول",status:401} as const;
 const ok=await withTenantTransaction(identity.tenantId,async tx=>{
  const [u]=await tx.select({role:users.role}).from(users).where(and(eq(users.tenantId,identity.tenantId),eq(users.externalAuthId,identity.externalAuthId))).limit(1);
  return !!u&&roles.includes(u.role);
 });
 return ok?{identity} as const:{error:"غير مصرح",status:403} as const;
}
