import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { DEMO_COMPANIES, DEMO_ROLES, demoSubject, type DemoRole } from "../demo/demo-config";

export const MOCK_COOKIE = "workspace_mock_session";
export type SessionIdentity = { tenantId:string; externalAuthId:string; role:DemoRole; companyName:string };
export function mockEnabled() {
  return process.env.NODE_ENV === "development" &&
    process.env.ENABLE_LOCAL_MOCK_LOGIN === "true" &&
    typeof process.env.MOCK_AUTH_SECRET === "string" &&
    process.env.MOCK_AUTH_SECRET.length >= 32;
}
export function isLocalRequest(req:Request) {
  const url = new URL(req.url);
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}
const key = () => new TextEncoder().encode(process.env.MOCK_AUTH_SECRET!);
export async function signMockSession(tenantId:string,role:DemoRole) {
  if (!mockEnabled()) throw new Error("Mock sign-in is disabled");
  const company = DEMO_COMPANIES.find(x=>x.id===tenantId);
  if (!company || !DEMO_ROLES.includes(role)) throw new Error("Unknown demo identity");
  return new SignJWT({ tenant_id:company.id,role, demo:true })
    .setProtectedHeader({alg:"HS256"})
    .setIssuer("local-workspace-demo")
    .setAudience("real-estate-workspace-demo")
    .setSubject(demoSubject(tenantId,role))
    .setIssuedAt().setExpirationTime("4h").sign(key());
}
export async function verifyMockToken(token:string):Promise<SessionIdentity|null> {
  if (!mockEnabled()) return null;
  try {
    const {payload}=await jwtVerify(token,key(),{
      issuer:"local-workspace-demo",audience:"real-estate-workspace-demo",algorithms:["HS256"],
    });
    const company=DEMO_COMPANIES.find(x=>x.id===payload.tenant_id);
    const role=payload.role;
    if (!company || !DEMO_ROLES.some(x=>x===role) ||
        payload.sub!==demoSubject(company.id,role as DemoRole) || payload.demo!==true) return null;
    return {tenantId:company.id,externalAuthId:payload.sub,role:role as DemoRole,companyName:company.name};
  } catch {return null;}
}
export async function getMockSession() {
  if (!mockEnabled()) return null;
  const cookieStore=await cookies();
  const token=cookieStore.get(MOCK_COOKIE)?.value;
  return token?verifyMockToken(token):null;
}
export async function verifyRequestIdentity(req:Request) {
  // Production NEVER accepts the development cookie.
  if (mockEnabled() && isLocalRequest(req)) {
    const cookieHeader=req.headers.get("cookie") || "";
    const token=cookieHeader.split(";").map(x=>x.trim()).find(x=>x.startsWith(MOCK_COOKIE+"="))?.slice(MOCK_COOKIE.length+1);
    if (token) {
      const identity=await verifyMockToken(token);
      if (identity) return {tenantId:identity.tenantId,externalAuthId:identity.externalAuthId};
    }
  }
  const {verifyBookingIdentity}=await import("./verify-booking-identity");
  return verifyBookingIdentity(req.headers.get("authorization"));
}
