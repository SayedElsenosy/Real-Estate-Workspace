import { and, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import { bookings, units, users } from "../db/schema";

export class BookingError extends Error {
  constructor(
    readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "UNIT_NOT_FOUND" | "UNIT_UNAVAILABLE",
    message: string,
    readonly httpStatus: number,
  ) { super(message); this.name = "BookingError"; }
}

export type NewBooking = {
  /** Signed identity provider claim, cross-checked against the local users table. */
  tenantId: string;
  externalAuthId: string;
  unitId: string;
  customerName: string;
  customerPhone: string;
  expiresAt?: Date | null;
};

/**
 * One PostgreSQL transaction, one row lock, one unit transition and one booking.
 * Never call with an admin connection or a client-supplied unverified tenant ID.
 */
export async function createConfirmedBooking(
  db: PostgresJsDatabase<typeof schema>,
  input: NewBooking,
) {
  return db.transaction(async (tx) => {
    // Transaction-local tenant context is safe with Neon connection pooling.
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${input.tenantId}, true)`);

    // Never trust role or tenant from JSON. JWT subject must map to this tenant's user.
    const [actor] = await tx.select({ id: users.id, role: users.role })
      .from(users)
      .where(and(
        eq(users.tenantId, input.tenantId),
        eq(users.externalAuthId, input.externalAuthId),
      )).limit(1);
    if (!actor) throw new BookingError("UNAUTHORIZED", "حساب المستخدم غير مرتبط بالشركة", 401);
    if (!["COMPANY_ADMIN", "SALES"].includes(actor.role))
      throw new BookingError("FORBIDDEN", "ليس لديك صلاحية الحجز", 403);

    // PESSIMISTIC LOCK: later concurrent transactions must wait for this row.
    const [unit] = await tx.select({ id: units.id, status: units.status })
      .from(units)
      .where(and(eq(units.tenantId, input.tenantId), eq(units.id, input.unitId)))
      .for("update")
      .limit(1);
    if (!unit) throw new BookingError("UNIT_NOT_FOUND", "الوحدة غير موجودة", 404);
    if (unit.status !== "AVAILABLE")
      throw new BookingError("UNIT_UNAVAILABLE", "الوحدة محجوزة بالفعل", 409);

    await tx.update(units).set({ status: "BOOKED" })
      .where(and(eq(units.tenantId, input.tenantId), eq(units.id, input.unitId)));

    const [booking] = await tx.insert(bookings).values({
      tenantId: input.tenantId,
      unitId: input.unitId,
      status: "CONFIRMED",
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      expiresAt: input.expiresAt ?? null,
    }).returning({
      id: bookings.id, unitId: bookings.unitId,
      status: bookings.status, bookingDate: bookings.bookingDate,
      expiresAt: bookings.expiresAt,
    });

    return { booking, unitStatus: "BOOKED" as const };
  });
}
