import { and, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import Decimal from "decimal.js";
import * as schema from "../db/schema";
import { contracts, installments, receipts, receiptChequeEvents, users } from "../db/schema";
import { parsePositiveMoney } from "../contracts/generate-installments";

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CHEQUE";
export type PaymentInput = {
  /** Verified server-side JWT claims, not untrusted JSON. */
  tenantId: string;
  externalAuthId: string;
  contractId: string;
  installmentId: string | null;
  amount: string; // decimal text, never JS float
  method: PaymentMethod;
  referenceNumber: string | null;
  receiptDate: string; // yyyy-mm-dd, validated by the HTTP layer
};

export class PaymentError extends Error {
  constructor(
    readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "CONTRACT_NOT_FOUND" |
      "CONTRACT_NOT_ACTIVE" | "INSTALLMENT_NOT_FOUND" | "ALREADY_PAID" |
      "AMOUNT_MISMATCH" | "AMOUNT_EXCEEDS_CONTRACT" | "REFERENCE_REQUIRED",
    message: string,
    readonly httpStatus: number,
  ) { super(message); this.name = "PaymentError"; }
}

/**
 * Exact full-installment settlement or an unapplied advance.
 * Lock order: contract -> installment. Concurrent settlements serialize.
 * All status changes and receipt INSERT happen in one transaction.
 */
export async function recordPayment(
  db: PostgresJsDatabase<typeof schema>,
  input: PaymentInput,
) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${input.tenantId}, true)`);

    const [actor] = await tx.select({id:users.id,role:users.role}).from(users)
      .where(and(eq(users.tenantId,input.tenantId),
        eq(users.externalAuthId,input.externalAuthId))).limit(1);
    if (!actor) throw new PaymentError("UNAUTHORIZED","حساب المستخدم غير مرتبط بالشركة",401);
    if (actor.role !== "ACCOUNTANT" && actor.role !== "COMPANY_ADMIN")
      throw new PaymentError("FORBIDDEN","ليس لديك صلاحية تسجيل المقبوضات",403);

    await tx.execute(sql`select set_config('app.actor_id',${actor.id},true)`);
    const amount = parsePositiveMoney(input.amount);
    if (input.method !== "CASH" && !input.referenceNumber?.trim())
      throw new PaymentError("REFERENCE_REQUIRED","رقم مرجع الشيك أو التحويل مطلوب",422);

    // A contract lock prevents both double settlement and concurrent over-collection
    // on different installments / advances in the same contract.
    const [contract] = await tx.select({
      id:contracts.id, status:contracts.status, total:contracts.totalAmount,
    }).from(contracts).where(and(
      eq(contracts.tenantId,input.tenantId),eq(contracts.id,input.contractId),
    )).for("update").limit(1);
    if (!contract) throw new PaymentError("CONTRACT_NOT_FOUND","العقد غير موجود",404);
    if (contract.status !== "ACTIVE")
      throw new PaymentError("CONTRACT_NOT_ACTIVE","العقد غير نشط",409);

    if (input.installmentId !== null) {
      const [installment] = await tx.select({
        id:installments.id,status:installments.status,amount:installments.amount,
      }).from(installments).where(and(
        eq(installments.tenantId,input.tenantId),
        eq(installments.contractId,input.contractId),
        eq(installments.id,input.installmentId),
      )).for("update").limit(1);

      if (!installment) throw new PaymentError("INSTALLMENT_NOT_FOUND","القسط غير موجود في العقد",404);
      if (installment.status === "PAID")
        throw new PaymentError("ALREADY_PAID","القسط مدفوع بالفعل",409);
      if (installment.status !== "PENDING" && installment.status !== "OVERDUE")
        throw new PaymentError("ALREADY_PAID","القسط مدفوع بالفعل",409);

      // No partial payments or overpayments against a specific installment yet.
      if (!amount.eq(parsePositiveMoney(installment.amount)))
        throw new PaymentError("AMOUNT_MISMATCH","يجب سداد قيمة القسط بالكامل دون زيادة أو نقصان",422);
    }

    // Numeric aggregation stays exact in PostgreSQL, then Decimal.js.
    const [aggregate] = await tx.select({
      collected: sql<string>`COALESCE(SUM(${receipts.amount}), 0)::text`,
    }).from(receipts).leftJoin(receiptChequeEvents,and(eq(receiptChequeEvents.tenantId,receipts.tenantId),eq(receiptChequeEvents.receiptId,receipts.id))).where(and(
      eq(receipts.tenantId,input.tenantId),eq(receipts.contractId,input.contractId),
      sql`COALESCE(${receiptChequeEvents.newStatus},${receipts.chequeClearanceStatus}) IS DISTINCT FROM 'BOUNCED'::public.cheque_clearance_status_enum`,
    ));
    const alreadyCollected = new Decimal(aggregate.collected);
    if (alreadyCollected.plus(amount).gt(parsePositiveMoney(contract.total)))
      throw new PaymentError("AMOUNT_EXCEEDS_CONTRACT","المبلغ يتجاوز القيمة المتبقية للعقد",422);

    if (input.installmentId !== null) {
      await tx.update(installments).set({status:"PAID"})
        .where(and(eq(installments.tenantId,input.tenantId),
          eq(installments.contractId,input.contractId),
          eq(installments.id,input.installmentId)));
    }

    // Any failure here rolls back status PAID, including unique reference conflicts.
    const [receipt] = await tx.insert(receipts).values({
      tenantId:input.tenantId,
      contractId:input.contractId,
      installmentId:input.installmentId,
      amount:amount.toFixed(2),
      method:input.method,
      chequeClearanceStatus:input.method==="CHEQUE"?"PENDING":"CLEARED",
      referenceNumber:input.referenceNumber?.trim() || null,
      receiptDate:input.receiptDate,
    }).returning({
      id:receipts.id,contractId:receipts.contractId,
      installmentId:receipts.installmentId,amount:receipts.amount,
      method:receipts.method,referenceNumber:receipts.referenceNumber,
      receiptDate:receipts.receiptDate,
    });

    return {receipt,installmentStatus:input.installmentId === null ? null : "PAID" as const};
  });
}
