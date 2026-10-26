import { NextRequest, NextResponse } from "next/server";
import { desc, ilike, or } from "drizzle-orm";
import { getVerifiedWorkspaceSession } from "@/lib/workspace/server-data";
import { withTenantTransaction } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";

/** Restricted tenant-scoped lookup for booking existing customers; never downloads the customer table. */
export async function GET(request: NextRequest) {
  const session=await getVerifiedWorkspaceSession();
  const search=(request.nextUrl.searchParams.get("search")??"").trim().slice(0,120);
  const pattern="%"+search.replace(/[\\%_]/g,"\\$&")+"%";
  const rows=await withTenantTransaction(session.tenantId,tx=>tx.select({
    id:customers.id,fullName:customers.fullName,phonePrimary:customers.phonePrimary,
  }).from(customers).where(search?or(ilike(customers.fullName,pattern),ilike(customers.phonePrimary,pattern)):undefined)
    .orderBy(desc(customers.createdAt),desc(customers.id)).limit(20));
  return NextResponse.json({customers:rows},{headers:{"Cache-Control":"no-store"}});
}
