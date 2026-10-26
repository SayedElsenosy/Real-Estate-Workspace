import { NextResponse } from "next/server";
import { verifyRequestIdentity } from "@/lib/auth/session";
import { createCompanyEmployee,type CompanyRole } from "@/lib/platform/administration";
export const runtime="nodejs";
export async function POST(request:Request){
 const identity=await verifyRequestIdentity(request);
 if(!identity)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 if(identity.role!=="COMPANY_ADMIN")return NextResponse.json({error:"FORBIDDEN"},{status:403});
 if(!request.headers.get("content-type")?.startsWith("application/json"))
  return NextResponse.json({error:"JSON_REQUIRED"},{status:415});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"INVALID_JSON"},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"INVALID_INPUT"},{status:400});
 const input=body as Record<string,unknown>;
 if(typeof input.fullName!=="string"||typeof input.email!=="string"||typeof input.password!=="string"||
  !["COMPANY_ADMIN","SALES","ACCOUNTANT"].includes(String(input.role)))return NextResponse.json({error:"INVALID_INPUT"},{status:400});
 try{
  const id=await createCompanyEmployee({
    fullName:input.fullName,email:input.email,password:input.password,
  },input.role as CompanyRole);
  return NextResponse.json({id},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(error){
  const code=error&&typeof error==="object"&&"code" in error?String(error.code):"";
  if(code==="23505")return NextResponse.json({error:"EMAIL_ALREADY_EXISTS"},{status:409});
  if(code==="42501"||error instanceof Error&&error.message==="FORBIDDEN")
   return NextResponse.json({error:"FORBIDDEN"},{status:403});
  if(code==="22023"||error instanceof Error&&error.message.startsWith("INVALID_"))
   return NextResponse.json({error:error instanceof Error?error.message:"INVALID_INPUT"},{status:400});
  console.error("Company managed account creation failed");
  return NextResponse.json({error:"ACCOUNT_CREATION_FAILED"},{status:500});
 }
}
