import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({
    service: "real-estate-workspace-foundation",
    status: "ok",
    authentication: "authjs-jwt",
    authConfigured: Boolean(process.env.AUTH_DATABASE_URL && process.env.AUTH_SECRET && process.env.AUTH_URL),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  }, { headers: { "Cache-Control": "no-store" } });
}
