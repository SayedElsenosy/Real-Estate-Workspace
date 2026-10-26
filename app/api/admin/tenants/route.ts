import { NextResponse } from "next/server";
import { verifyRequestIdentity } from "@/lib/auth/session";
import { changeTenantStatus, createPlatformTenant } from "@/lib/platform/administration";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
export async function POST(request:Request) {
 const identity=await verifyRequestIdentity(request);
 if(!identity) return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 if(identity.role!=="PLATFORM_OWNER") return NextResponse.json({error:"FORBIDDEN"},{status:403});
 if(!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({error:"JSON_REQUIRED"},{status:415});
 let input:unknown;try{input=await request.json();}catch{return NextResponse.json({error:"INVALID_JSON"},{status:400});}
 if(!input||typeof input!=="object"||Array.isArray(input)) return NextResponse.json({error:"INVALID_INPUT"},{status:400});
 const body=input as Record<string,unknown>;
 try {
  if(body.action==="create"&&typeof body.name==="string"&&body.name.trim().length>=2&&body.name.length<=200){
   const tenant=await createPlatformTenant(body.name);
   return NextResponse.json({tenant},{status:201});
  }
  if(body.action==="status"&&typeof body.id==="string"&&uuid.test(body.id)&&typeof body.active==="boolean"){
   await changeTenantStatus(body.id,body.active);
   return NextResponse.json({ok:true});
  }
  return NextResponse.json({error:"INVALID_INPUT"},{status:400});
 }catch(err){
  const code=err&&typeof err==="object"&&"code" in err ? String(err.code):"";
  if(code==="23505")return NextResponse.json({error:"SLUG_ALREADY_EXISTS"},{status:409});
  if(code==="P0002")return NextResponse.json({error:"NOT_FOUND"},{status:404});
  if(code==="42501"||err instanceof Error&&err.message==="FORBIDDEN")return NextResponse.json({error:"FORBIDDEN"},{status:403});
  console.error("Platform admin operation error");
  return NextResponse.json({error:"OPERATION_FAILED"},{status:500});
 }
}
