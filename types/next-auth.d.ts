import type { DefaultSession } from "next-auth";
import type { userRole } from "@/lib/db/schema";
type Role = typeof userRole.enumValues[number];
interface IdentityClaims {
 tenantId:string; role:Role; externalAuthId:string; companyName:string; authVersion:number;
}
declare module "next-auth" {
 interface User extends IdentityClaims {}
 interface Session { user: DefaultSession["user"] & IdentityClaims & {id:string}; }
}
declare module "@auth/core/jwt" { interface JWT extends IdentityClaims {} }
