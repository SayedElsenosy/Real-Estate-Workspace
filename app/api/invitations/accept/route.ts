import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthDatabase } from "@/lib/db/auth-client";
export const runtime="nodejs";
export async function POST(request:Request) {
 const origin=request.headers.get("origin");
 const expected=new URL(process.env.AUTH_URL??request.url).origin;
 if((origin&&origin!==expected)||request.headers.get("sec-fetch-site")==="cross-site")
  return NextResponse.json({error:"FORBIDDEN_ORIGIN"},{status:403});
 if(!request.headers.get("content-type")?.startsWith("application/json"))
  return NextResponse.json({error:"JSON_REQUIRED"},{status:415});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"INVALID_JSON"},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"INVALID_INPUT"},{status:400});
 const {token,fullName,password}=body as Record<string,unknown>;
 if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token)||
  typeof fullName!=="string"||fullName.trim().length<2||fullName.trim().length>200||
  typeof password!=="string"||password.length<12||Buffer.byteLength(password,"utf8")>72)
  return NextResponse.json({error:"INVALID_INPUT"},{status:400});
 const digest=createHash("sha256").update(token).digest("hex");
 const passwordHash=await hash(password,12);
 try {
  await getAuthDatabase().execute(sql`select app.accept_invitation(${digest},${fullName.trim()},${passwordHash})`);
  return NextResponse.json({ok:true,loginUrl:"/login"},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(error) {
  const code=error&&typeof error==="object"&&"code" in error?String(error.code):"";
  if(code==="P0002"||code==="42501")return NextResponse.json({error:"INVITE_INVALID_OR_EXPIRED"},{status:410});
  if(code==="23505")return NextResponse.json({error:"ACCOUNT_ALREADY_EXISTS"},{status:409});
  console.error("Invitation acceptance error");
  return NextResponse.json({error:"INVITATION_ACCEPT_FAILED"},{status:500});
 }
}
