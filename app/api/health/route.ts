import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({
    service: "real-estate-workspace-foundation",
    phase: 1,
    status: "ok",
    authentication: "not-enabled",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  }, { headers: { "Cache-Control": "no-store" } });
}
