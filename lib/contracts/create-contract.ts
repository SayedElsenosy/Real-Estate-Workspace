import { and, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import { bookings, contracts, installments, units, users } from "../db/schema";
import { generateInstallments, parsePositiveMoney, type PaymentPlan } from "./generate-installments";

export class ContractError extends Error {
  constructor(
    readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "BOOKING_NOT_FOUND" |
      "BOOKING_NOT_CONFIRMED" | "BOOKING_EXPIRED" | "PRICE_MISMATCH" | "CONTRACT_EXISTS",
    message: string,
    readonly httpStatus: number,
  ) { super(message); this.name = "ContractError"; }
}

export type CreateContractInput = {
  tenantId: string;
  externalAuthId: string;
  bookingId: string;
  totalAmount: string;
  paymentPlan: PaymentPlan;
};

/** One atomic transaction: verify, lock booking, snapshot price, insert contract and installments. */
export async function createSignedContract(
  db: PostgresJsDatabase<typeof schema>,
  input: CreateContractInput,
) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${input.tenantId}, true)`);
    const [actor] = await tx.select({id:users.id,role:users.role}).from(users)
      .where(and(eq(users.tenantId, input.tenantId),eq(users.externalAuthId,input.externalAuthId))).limit(1);
    if (!actor) throw new ContractError("UNAUTHORIZED","حساب المستخدم غير مرتبط بالشركة",401);
    if (actor.role !== "COMPANY_ADMIN")
      throw new ContractError("FORBIDDEN","توقيع العقود متاح لمدير الشركة فقط حاليًا",403);

    await tx.execute(sql`select set_config('app.actor_id',${actor.id},true)`);
    // Concurrent signatures serialize on the same booking row.
    const [booking] = await tx.select({
      id: bookings.id, unitId: bookings.unitId,
      status: bookings.status, expiresAt: bookings.expiresAt,
    }).from(bookings)
      .where(and(eq(bookings.tenantId,input.tenantId),eq(bookings.id,input.bookingId)))
      .for("update").limit(1);
    if (!booking) throw new ContractError("BOOKING_NOT_FOUND","الحجز غير موجود",404);
    if (booking.status !== "CONFIRMED")
      throw new ContractError("BOOKING_NOT_CONFIRMED","يجب تأكيد الحجز قبل توقيع العقد",409);
    const signedAt = new Date();
    if (booking.expiresAt && booking.expiresAt <= signedAt)
      throw new ContractError("BOOKING_EXPIRED","انتهت صلاحية الحجز",409);

    const [existing] = await tx.select({id:contracts.id}).from(contracts)
      .where(and(eq(contracts.tenantId,input.tenantId),eq(contracts.bookingId,input.bookingId)))
      .limit(1);
    if (existing) throw new ContractError("CONTRACT_EXISTS","يوجد عقد لهذا الحجز بالفعل",409);

    const [unit] = await tx.select({ price: units.price, status: units.status })
      .from(units).where(and(eq(units.tenantId,input.tenantId),eq(units.id,booking.unitId)))
      .for("update").limit(1);
    if (!unit || unit.status !== "BOOKED")
      throw new ContractError("BOOKING_NOT_CONFIRMED","الوحدة غير محجوزة",409);

    // No uncontrolled discounts without a separate approved pricing workflow.
    const requested = parsePositiveMoney(input.totalAmount);
    if (!requested.eq(parsePositiveMoney(unit.price)))
      throw new ContractError("PRICE_MISMATCH","إجمالي العقد لا يطابق سعر الوحدة المعتمد",422);



    const [contract] = await tx.insert(contracts).values({
      tenantId: input.tenantId,
      bookingId: input.bookingId,
      totalAmount: requested.toFixed(2),
      unitPriceSnapshot: unit.price,
      paymentPlanSnapshot: input.paymentPlan,
      status: "ACTIVE",
      signedAt,
    }).returning({ id: contracts.id, status: contracts.status,
      signedAt: contracts.signedAt, totalAmount: contracts.totalAmount,
      unitPriceSnapshot: contracts.unitPriceSnapshot });

    // Any invalid plan or failed row insert rolls back the entire contract.
    const schedule = generateInstallments(contract.totalAmount, signedAt, input.paymentPlan);
    const rows = await tx.insert(installments).values(schedule.map(item => ({
      tenantId: input.tenantId, contractId: contract.id,
      sequence: item.sequence, dueDate: item.dueDate,
      amount: item.amount, isDownPayment: item.isDownPayment,
      status: "PENDING" as const,
    }))).returning({
      id: installments.id, sequence: installments.sequence,
      dueDate: installments.dueDate, amount: installments.amount,
      status: installments.status, isDownPayment: installments.isDownPayment,
    });

    await tx.update(units).set({status:"SOLD"}).where(and(eq(units.tenantId,input.tenantId),eq(units.id,booking.unitId)));

    return { contract, installments: rows,unitStatus:"SOLD" as const };
  });
}
