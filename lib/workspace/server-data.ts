import "server-only";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { getMockSession } from "../auth/mock-session";
import { withTenantTransaction } from "../db/client";
import { buildings, bookings, contracts, customers, installments, phases, projects, receipts, units, users } from "../db/schema";

export async function getVerifiedWorkspaceSession() {
  const identity=await getMockSession();
  if (!identity) redirect("/login");
  const membership=await withTenantTransaction(identity.tenantId,async tx=>{
    const [user]=await tx.select({id:users.id,role:users.role}).from(users)
      .where(and(eq(users.tenantId,identity.tenantId),eq(users.externalAuthId,identity.externalAuthId))).limit(1);
    return user;
  });
  if (!membership || membership.role!==identity.role) redirect("/login");
  return identity;
}

/** All reads run with the verified, transaction-local tenant context and PostgreSQL RLS. */
export async function loadWorkspace() {
  const session=await getVerifiedWorkspaceSession();
  const data=await withTenantTransaction(session.tenantId,async tx=>{
    const [projectRows,phaseRows,buildingRows,unitRows,bookingRows,customerRows,contractRows,installmentRows,receiptRows,sales]=await Promise.all([
      tx.select({id:projects.id,name:projects.name,location:projects.location,status:projects.status}).from(projects).orderBy(projects.name),
      tx.select({id:phases.id,projectId:phases.projectId,name:phases.name}).from(phases),
      tx.select({id:buildings.id,phaseId:buildings.phaseId,name:buildings.name}).from(buildings),
      tx.select({id:units.id,buildingId:units.buildingId,unitNumber:units.unitNumber,price:units.price,area:units.area,status:units.status,svgCoordinates:units.svgCoordinates}).from(units).orderBy(units.unitNumber),
      tx.select({id:bookings.id,unitId:bookings.unitId,customerId:bookings.customerId,customerName:bookings.customerName,customerPhone:bookings.customerPhone,status:bookings.status,bookingDate:bookings.bookingDate}).from(bookings).orderBy(bookings.bookingDate),
      tx.select({id:customers.id,fullName:customers.fullName,phonePrimary:customers.phonePrimary,phoneSecondary:customers.phoneSecondary,email:customers.email,nationalId:customers.nationalId,createdAt:customers.createdAt}).from(customers),
      tx.select({id:contracts.id,bookingId:contracts.bookingId,totalAmount:contracts.totalAmount,status:contracts.status,signedAt:contracts.signedAt}).from(contracts),
      tx.select({id:installments.id,contractId:installments.contractId,sequence:installments.sequence,amount:installments.amount,status:installments.status,dueDate:installments.dueDate}).from(installments),
      tx.select({id:receipts.id,contractId:receipts.contractId,installmentId:receipts.installmentId,amount:receipts.amount,method:receipts.method,chequeClearanceStatus:receipts.chequeClearanceStatus,bouncedReason:receipts.bouncedReason,bouncedAt:receipts.bouncedAt,receiptDate:receipts.receiptDate}).from(receipts),
      tx.select({total:sql<string>`COALESCE(SUM(${contracts.totalAmount}),0)::text`}).from(contracts).where(eq(contracts.status,"ACTIVE")),
    ]);
    return {projects:projectRows,phases:phaseRows,buildings:buildingRows,units:unitRows,bookings:bookingRows,customers:customerRows,contracts:contractRows,installments:installmentRows,receipts:receiptRows, totalSales:sales[0]?.total??"0"};
  });
  return {session,...data};
}
