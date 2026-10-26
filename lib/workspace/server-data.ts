import "server-only";
import { redirect } from "next/navigation";
import { and, eq, sql, ilike, or, desc, lt } from "drizzle-orm";
import { getDatabaseSession } from "../auth/session";
import { withTenantTransaction } from "../db/client";
import { buildings, bookings, contracts, customers, installments, phases, projects, receipts, receiptChequeEvents, units, users } from "../db/schema";

export async function getVerifiedWorkspaceSession() {
  const identity=await getDatabaseSession();
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
async function loadWorkspaceLegacy() {
  const session=await getVerifiedWorkspaceSession();
  const data=await withTenantTransaction(session.tenantId,async tx=>{
    const [projectRows,phaseRows,buildingRows,unitRows,bookingRows,customerRows,contractRows,installmentRows,receiptRows,chequeEventRows,sales]=await Promise.all([
      tx.select({id:projects.id,name:projects.name,location:projects.location,status:projects.status}).from(projects).orderBy(projects.name),
      tx.select({id:phases.id,projectId:phases.projectId,name:phases.name}).from(phases),
      tx.select({id:buildings.id,phaseId:buildings.phaseId,name:buildings.name}).from(buildings),
      tx.select({id:units.id,buildingId:units.buildingId,unitNumber:units.unitNumber,price:units.price,area:units.area,status:units.status,svgCoordinates:units.svgCoordinates}).from(units).orderBy(units.unitNumber),
      tx.select({id:bookings.id,unitId:bookings.unitId,customerId:bookings.customerId,customerName:bookings.customerName,customerPhone:bookings.customerPhone,status:bookings.status,bookingDate:bookings.bookingDate}).from(bookings).orderBy(bookings.bookingDate),
      tx.select({id:customers.id,fullName:customers.fullName,phonePrimary:customers.phonePrimary,phoneSecondary:customers.phoneSecondary,email:customers.email,nationalId:customers.nationalId,createdAt:customers.createdAt}).from(customers),
      tx.select({id:contracts.id,bookingId:contracts.bookingId,totalAmount:contracts.totalAmount,status:contracts.status,signedAt:contracts.signedAt}).from(contracts),
      tx.select({id:installments.id,contractId:installments.contractId,sequence:installments.sequence,amount:installments.amount,status:installments.status,dueDate:installments.dueDate}).from(installments),
      tx.select({id:receipts.id,contractId:receipts.contractId,installmentId:receipts.installmentId,amount:receipts.amount,method:receipts.method,referenceNumber:receipts.referenceNumber,chequeClearanceStatus:receipts.chequeClearanceStatus,bouncedReason:receipts.bouncedReason,bouncedAt:receipts.bouncedAt,receiptDate:receipts.receiptDate}).from(receipts),
      tx.select({receiptId:receiptChequeEvents.receiptId,newStatus:receiptChequeEvents.newStatus,reason:receiptChequeEvents.reason,recordedAt:receiptChequeEvents.recordedAt}).from(receiptChequeEvents),
      tx.select({total:sql<string>`COALESCE(SUM(${contracts.totalAmount}),0)::text`}).from(contracts).where(eq(contracts.status,"ACTIVE")),
    ]);
    return {projects:projectRows,phases:phaseRows,buildings:buildingRows,units:unitRows,bookings:bookingRows,customers:customerRows,contracts:contractRows,installments:installmentRows,receipts:receiptRows.map(r=>{const event=chequeEventRows.find(e=>e.receiptId===r.id);return event?{...r,chequeClearanceStatus:event.newStatus,bouncedReason:event.reason,bouncedAt:event.recordedAt}:r;}), totalSales:sales[0]?.total??"0"};
  });
  return {session,...data};
}
 
/** Lightweight dashboard read: database aggregations, always scoped to the verified tenant via RLS. */
export async function getDashboardStats() {
  const session = await getVerifiedWorkspaceSession();
  const data = await withTenantTransaction(session.tenantId, async tx => {
    const [activeContractsRows, availableUnitsRows, projectCountRows, bookingCountRows, receiptCountRows, featuredProjects] = await Promise.all([
      tx.select({
        totalSales: sql<string>`COALESCE(SUM(${contracts.totalAmount}), 0)::text`,
        count: sql<number>`COUNT(*)::int`,
      }).from(contracts).where(eq(contracts.status, "ACTIVE")),
      tx.select({ count: sql<number>`COUNT(*)::int` }).from(units).where(eq(units.status, "AVAILABLE")),
      tx.select({ count: sql<number>`COUNT(*)::int` }).from(projects),
      tx.select({ count: sql<number>`COUNT(*)::int` }).from(bookings),
      tx.select({ count: sql<number>`COUNT(*)::int` }).from(receipts),
      tx.select({ id: projects.id, name: projects.name, location: projects.location, status: projects.status })
        .from(projects).orderBy(projects.name).limit(4),
    ]);
    return {
      totalSales: activeContractsRows[0]?.totalSales ?? "0",
      activeContracts: activeContractsRows[0]?.count ?? 0,
      availableUnits: availableUnitsRows[0]?.count ?? 0,
      projectsCount: projectCountRows[0]?.count ?? 0,
      bookingsCount: bookingCountRows[0]?.count ?? 0,
      receiptsCount: receiptCountRows[0]?.count ?? 0,
      featuredProjects,
    };
  });
  return { session, ...data };
}

/** Database-side pagination for the five primary lists; auth and RLS are mandatory. */
export type WorkspaceListQuery = {
  resource: "units" | "customers" | "bookings" | "contracts" | "receipts";
  page?: string | number | string[];
  limit?: string | number | string[];
  search?: string | string[];
  project?: string | string[];
  phase?: string | string[];
  building?: string | string[];
};
function valueOf(v: unknown): string {
  return typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? v[0] : typeof v === "number" ? String(v) : "";
}
function intOf(v: unknown, fallback: number, maximum: number) {
  const text = valueOf(v);
  if (!/^[1-9]\d*$/.test(text)) return fallback;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? Math.min(parsed, maximum) : fallback;
}
function parsedQuery(query: WorkspaceListQuery) {
  const page = intOf(query.page, 1, 100000);
  const limit = intOf(query.limit, 20, 100);
  const search = valueOf(query.search).trim().slice(0, 120);
  const pattern = "%" + search.replace(/[\\%_]/g, "\\$&") + "%";
  return { page, limit, search, pattern, offset: (page - 1) * limit };
}
function pageInfo(page: number, limit: number, search: string, total: number) {
  return { page, limit, search, total, pages: Math.max(1, Math.ceil(total / limit)) };
}
async function loadWorkspacePaged(input: WorkspaceListQuery) {
  const session = await getVerifiedWorkspaceSession();
  const { page, limit, offset, search, pattern } = parsedQuery(input);
  const data = await withTenantTransaction(session.tenantId, async tx => {
    const count = sql<number>(["COUNT(*)::int"] as unknown as TemplateStringsArray);
    switch (input.resource) {
      case "units": {
        const [projectRows, phaseRows, buildingRows] = await Promise.all([
          tx.select({id:projects.id,name:projects.name,location:projects.location,status:projects.status}).from(projects).orderBy(projects.name,projects.id),
          tx.select({id:phases.id,projectId:phases.projectId,name:phases.name}).from(phases).orderBy(phases.name,phases.id),
          tx.select({id:buildings.id,phaseId:buildings.phaseId,name:buildings.name}).from(buildings).orderBy(buildings.name,buildings.id),
        ]);
        const project = projectRows.find(p => p.id === valueOf(input.project)) ?? projectRows[0];
        const phase = phaseRows.find(p => p.projectId === project?.id && p.id === valueOf(input.phase))
          ?? phaseRows.find(p => p.projectId === project?.id);
        const building = buildingRows.find(b => b.phaseId === phase?.id && b.id === valueOf(input.building))
          ?? buildingRows.find(b => b.phaseId === phase?.id);
        const where = building ? and(eq(units.buildingId,building.id),search ? ilike(units.unitNumber,pattern) : undefined)
          : eq(units.id,"00000000-0000-0000-0000-000000000000");
        const [totals,rows] = await Promise.all([
          tx.select({total:count}).from(units).where(where),
          tx.select({id:units.id,buildingId:units.buildingId,unitNumber:units.unitNumber,price:units.price,area:units.area,status:units.status,svgCoordinates:units.svgCoordinates})
            .from(units).where(where).orderBy(units.unitNumber,units.id).limit(limit).offset(offset),
        ]);
        return {resource:"units" as const,rows,projects:projectRows,phases:phaseRows,buildings:buildingRows,
          selectedProjectId:project?.id??null,selectedPhaseId:phase?.id??null,selectedBuildingId:building?.id??null,
          pagination:pageInfo(page,limit,search,totals[0]?.total??0)};
      }
      case "customers": {
        const where = search ? or(ilike(customers.fullName,pattern),ilike(customers.phonePrimary,pattern),
          ilike(customers.phoneSecondary,pattern),ilike(customers.email,pattern)) : undefined;
        const [totals,rows] = await Promise.all([
          tx.select({total:count}).from(customers).where(where),
          tx.select({id:customers.id,fullName:customers.fullName,phonePrimary:customers.phonePrimary,phoneSecondary:customers.phoneSecondary,email:customers.email})
            .from(customers).where(where).orderBy(desc(customers.createdAt),desc(customers.id)).limit(limit).offset(offset),
        ]);
        return {resource:"customers" as const,rows,pagination:pageInfo(page,limit,search,totals[0]?.total??0)};
      }
      case "bookings": {
        const where=search ? or(ilike(bookings.customerName,pattern),ilike(bookings.customerPhone,pattern),ilike(units.unitNumber,pattern)) : undefined;
        const [totals,rows] = await Promise.all([
          tx.select({total:count}).from(bookings).innerJoin(units,eq(bookings.unitId,units.id)).where(where),
          tx.select({id:bookings.id,unitId:bookings.unitId,customerName:bookings.customerName,status:bookings.status,
            bookingDate:bookings.bookingDate,unitNumber:units.unitNumber,unitPrice:units.price,contractId:contracts.id})
            .from(bookings).innerJoin(units,eq(bookings.unitId,units.id))
            .leftJoin(contracts,eq(contracts.bookingId,bookings.id)).where(where)
            .orderBy(desc(bookings.bookingDate),desc(bookings.id)).limit(limit).offset(offset),
        ]);
        return {resource:"bookings" as const,rows,pagination:pageInfo(page,limit,search,totals[0]?.total??0)};
      }
      case "contracts": {
        const where=search ? or(ilike(bookings.customerName,pattern),ilike(bookings.customerPhone,pattern),
          ilike(sql.raw("contracts.id::text"),pattern)) : undefined;
        const [totals,rows] = await Promise.all([
          tx.select({total:count}).from(contracts).innerJoin(bookings,eq(contracts.bookingId,bookings.id)).where(where),
          tx.select({id:contracts.id,totalAmount:contracts.totalAmount,status:contracts.status,customerName:bookings.customerName})
            .from(contracts).innerJoin(bookings,eq(contracts.bookingId,bookings.id))
            .where(where).orderBy(desc(contracts.createdAt),desc(contracts.id)).limit(limit).offset(offset),
        ]);
        return {resource:"contracts" as const,rows,pagination:pageInfo(page,limit,search,totals[0]?.total??0)};
      }
      case "receipts": {
        const status=sql<string>(["COALESCE(receipt_cheque_events.new_status, receipts.cheque_clearance_status)"] as unknown as TemplateStringsArray);
        const where=search ? or(ilike(receipts.referenceNumber,pattern),ilike(bookings.customerName,pattern),
          ilike(sql.raw("receipts.id::text"),pattern)) : undefined;
        const [totals,rows,today,pending,overdue,pendingCheques] = await Promise.all([
          tx.select({total:count}).from(receipts).innerJoin(contracts,eq(receipts.contractId,contracts.id))
            .innerJoin(bookings,eq(contracts.bookingId,bookings.id)).where(where),
          tx.select({id:receipts.id,contractId:receipts.contractId,amount:receipts.amount,method:receipts.method,
            referenceNumber:receipts.referenceNumber,receiptDate:receipts.receiptDate,chequeClearanceStatus:status,
            customerName:bookings.customerName})
            .from(receipts).innerJoin(contracts,eq(receipts.contractId,contracts.id))
            .innerJoin(bookings,eq(contracts.bookingId,bookings.id))
            .leftJoin(receiptChequeEvents,eq(receiptChequeEvents.receiptId,receipts.id))
            .where(where).orderBy(desc(receipts.receiptDate),desc(receipts.id)).limit(limit).offset(offset),
          tx.select({total:sql<string>(["COALESCE(SUM(receipts.amount),0)::text"] as unknown as TemplateStringsArray)})
            .from(receipts).leftJoin(receiptChequeEvents,eq(receiptChequeEvents.receiptId,receipts.id))
            .where(and(eq(receipts.receiptDate,sql.raw("(now() AT TIME ZONE 'Africa/Cairo')::date")),eq(status,"CLEARED"))),
          tx.select({total:sql<string>(["COALESCE(SUM(receipts.amount),0)::text"] as unknown as TemplateStringsArray)})
            .from(receipts).leftJoin(receiptChequeEvents,eq(receiptChequeEvents.receiptId,receipts.id))
            .where(and(eq(receipts.method,"CHEQUE"),eq(status,"PENDING"))),
          tx.select({total:sql<string>(["COALESCE(SUM(installments.amount),0)::text"] as unknown as TemplateStringsArray)})
            .from(installments).where(or(eq(installments.status,"OVERDUE"),
              and(eq(installments.status,"PENDING"),lt(installments.dueDate,sql.raw("(now() AT TIME ZONE 'Africa/Cairo')::date"))))),
          tx.select({id:receipts.id,amount:receipts.amount,referenceNumber:receipts.referenceNumber,
            receiptDate:receipts.receiptDate,customer:bookings.customerName}).from(receipts)
            .innerJoin(contracts,eq(receipts.contractId,contracts.id)).innerJoin(bookings,eq(contracts.bookingId,bookings.id))
            .leftJoin(receiptChequeEvents,eq(receiptChequeEvents.receiptId,receipts.id))
            .where(and(eq(receipts.method,"CHEQUE"),eq(status,"PENDING")))
            .orderBy(desc(receipts.receiptDate),desc(receipts.id)).limit(20),
        ]);
        return {resource:"receipts" as const,rows,pagination:pageInfo(page,limit,search,totals[0]?.total??0),
          treasury:{todayTotal:today[0]?.total??"0",pendingAmount:pending[0]?.total??"0",
            overdueAmount:overdue[0]?.total??"0",pendingCheques}};
      }
    }
  });
  return {session,...data};
}
/** Legacy full-history reads remain for detail/report screens; list screens use limited SQL. */
export function loadWorkspace(): ReturnType<typeof loadWorkspaceLegacy>;
export function loadWorkspace(options: WorkspaceListQuery): ReturnType<typeof loadWorkspacePaged>;
export async function loadWorkspace(options?: WorkspaceListQuery) {
  return options ? loadWorkspacePaged(options) : loadWorkspaceLegacy();
}
