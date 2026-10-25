import {templateAuth} from "@/lib/contracts/template-auth";
import {sampleDocx} from "@/lib/contracts/sample-docx";
import {NextResponse} from "next/server";
export const runtime="nodejs";
export async function GET(req:Request){const auth=await templateAuth(req);if("error" in auth)return NextResponse.json({error:auth.error},{status:auth.status});return new Response(new Uint8Array(sampleDocx()),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":'attachment; filename="sample-contract.docx"'}})}
