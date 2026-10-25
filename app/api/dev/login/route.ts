import { NextResponse } from "next/server";
import { DEMO_COMPANIES, DEMO_ROLES, type DemoRole } from "@/lib/demo/demo-config";
import { MOCK_COOKIE, isLocalRequest, mockEnabled, signMockSession } from "@/lib/auth/mock-session";
export const runtime="nodejs";
export async function POST(req:Request) {
  if (!mockEnabled() || !isLocalRequest(req))
    return NextResponse.json({error:"غير متاح"},{status:404});
  let value:unknown;
  try { value=await req.json(); } catch { return NextResponse.json({error:"طلب غير صالح"},{status:400}); }
  if (!value || typeof value!=="object") return NextResponse.json({error:"طلب غير صالح"},{status:400});
  const data=value as Record<string,unknown>;
  if (Object.keys(data).some(k=>!["tenantId","role"].includes(k)) ||
    !DEMO_COMPANIES.some(c=>c.id===data.tenantId) ||
    !DEMO_ROLES.some(r=>r===data.role))
    return NextResponse.json({error:"شركة أو صلاحية تجريبية غير صالحة"},{status:400});
  // Enforce same-origin even in local dev, since this issues an HttpOnly cookie.
  const origin=req.headers.get("origin");
  if (!origin || new URL(origin).origin!==new URL(req.url).origin)
    return NextResponse.json({error:"طلب غير مصرح به"},{status:403});
  const token=await signMockSession(data.tenantId as string,data.role as DemoRole);
  const response=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set(MOCK_COOKIE,token,{
    httpOnly:true,sameSite:"strict",secure:false,path:"/",maxAge:4*60*60,
  });
  return response;
}
