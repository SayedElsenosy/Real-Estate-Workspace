import { NextResponse } from "next/server";
import { verifyRequestIdentity } from "@/lib/auth/session";
import { changeTenantStatus,createPlatformTenant,createPlatformCompanyAdmin } from "@/lib/platform/administration";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(error:unknown) {
 const code=error&&typeof error==="object"&&"code" in error?String(error.code):"";
 if(code==="23505")return NextResponse.json({error:"EMAIL_OR_SLUG_EXISTS"},{status:409});
 if(code==="P0002")return NextResponse.json({error:"TENANT_NOT_FOUND_OR_INACTIVE"},{status:404});
 if(code==="42501"||error instanceof Error&&error.message==="FORBIDDEN")
  return NextResponse.json({error:"FORBIDDEN"},{status:403});
 if(code==="22023"||error instanceof Error&&error.message.startsWith("INVALID_"))
  return NextResponse.json({error:error instanceof Error?error.message:"INVALID_INPUT"},{status:400});
 console.error("Platform company management failed");
 return NextResponse.json({error:"OPERATION_FAILED"},{status:500});
}
export async function POST(request:Request) {
 const identity=await verifyRequestIdentity(request);
 if(!identity)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 if(identity.role!=="PLATFORM_OWNER")return NextResponse.json({error:"FORBIDDEN"},{status:403});
 if(!request.headers.get("content-type")?.startsWith("application/json"))
   return NextResponse.json({error:"JSON_REQUIRED"},{status:415});
 let input:unknown;try{input=await request.json();}catch{return NextResponse.json({error:"INVALID_JSON"},{status:400});}
 if(!input||typeof input!=="object"||Array.isArray(input))return NextResponse.json({error:"INVALID_INPUT"},{status:400});
 const body=input as Record<string,unknown>;
 try {
  if(body.action==="create"&&typeof body.name==="string"&&typeof body.adminName==="string"&&
    typeof body.adminEmail==="string"&&typeof body.adminPassword==="string") {
    const tenant=await createPlatformTenant(body.name,{
      fullName:body.adminName,email:body.adminEmail,password:body.adminPassword,
    });
    return NextResponse.json({tenant},{status:201,headers:{"Cache-Control":"no-store"}});
  }
  if(body.action==="create_admin"&&typeof body.id==="string"&&uuid.test(body.id)&&
    typeof body.adminName==="string"&&typeof body.adminEmail==="string"&&typeof body.adminPassword==="string") {
    const id=await createPlatformCompanyAdmin(body.id,{
      fullName:body.adminName,email:body.adminEmail,password:body.adminPassword,
    });
    return NextResponse.json({userId:id},{status:201,headers:{"Cache-Control":"no-store"}});
  }
  if(body.action==="status"&&typeof body.id==="string"&&uuid.test(body.id)&&typeof body.active==="boolean"){
   await changeTenantStatus(body.id,body.active);
   return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  }
  return NextResponse.json({error:"INVALID_INPUT"},{status:400});
 }catch(error){return fail(error);}
}
