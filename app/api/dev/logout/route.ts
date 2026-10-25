import { NextResponse } from "next/server";
import { MOCK_COOKIE,isLocalRequest,mockEnabled } from "@/lib/auth/mock-session";
export async function POST(req:Request) {
  if(!mockEnabled()||!isLocalRequest(req))
    return NextResponse.json({error:"غير متاح"},{status:404});
  const origin=req.headers.get("origin");
  if(!origin || new URL(origin).host!==req.headers.get("host"))
    return NextResponse.json({error:"غير مصرح"},{status:403});
  const response=NextResponse.json({ok:true});
  response.cookies.set(MOCK_COOKIE,"",{path:"/",maxAge:0,httpOnly:true,sameSite:"strict"});
  return response;
}
