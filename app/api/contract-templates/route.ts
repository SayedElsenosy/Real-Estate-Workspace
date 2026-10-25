import {NextResponse} from "next/server";
export const runtime="nodejs";
export async function POST(){return NextResponse.json({error:"Upload not configured"},{status:503});}
