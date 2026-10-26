import { NextResponse } from "next/server";
import { verifyRequestIdentity } from "@/lib/auth/session";
import { createInvitation, revokeInvitation, sendInvitationEmail, type InviteRole } from "@/lib/platform/administration";
export const runtime="nodejs";
export async function POST(request:Request){
 const identity=await verifyRequestIdentity(request);
 if(!identity)return NextResponse.json({error:"UNAUTHORIZED"},{status:401});
 if(identity.role!=="COMPANY_ADMIN")return NextResponse.json({error:"FORBIDDEN"},{status:403});
 if(!request.headers.get("content-type")?.startsWith("application/json"))return NextResponse.json({error:"JSON_REQUIRED"},{status:415});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"INVALID_JSON"},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"INVALID_INPUT"},{status:400});
 const input=body as Record<string,unknown>;
 if(typeof input.email!=="string"||input.email.length>254||
   !["COMPANY_ADMIN","SALES","ACCOUNTANT"].includes(String(input.role)))
  return NextResponse.json({error:"INVALID_INPUT"},{status:400});
 if(!process.env.RESEND_API_KEY||!process.env.INVITATION_FROM_EMAIL||!process.env.AUTH_URL?.startsWith("https://"))
  return NextResponse.json({error:"EMAIL_NOT_CONFIGURED"},{status:503});
 try{
  const invite=await createInvitation(input.email,input.role as InviteRole);
  try {
   await sendInvitationEmail(invite);
  }catch{
   await revokeInvitation(invite.id);
   return NextResponse.json({error:"EMAIL_SEND_FAILED"},{status:502});
  }
  return NextResponse.json({id:invite.id,expiresInHours:72},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(error){
  const code=error&&typeof error==="object"&&"code" in error?String(error.code):"";
  if(code==="23505")return NextResponse.json({error:"EMAIL_ALREADY_REGISTERED_OR_INVITED"},{status:409});
  if(code==="42501"||error instanceof Error&&error.message==="FORBIDDEN")return NextResponse.json({error:"FORBIDDEN"},{status:403});
  if(error instanceof Error&&["INVALID_EMAIL","INVALID_ROLE"].includes(error.message))
   return NextResponse.json({error:error.message},{status:400});
  console.error("Invitation creation failed");
  return NextResponse.json({error:"INVITATION_FAILED"},{status:500});
 }
}
