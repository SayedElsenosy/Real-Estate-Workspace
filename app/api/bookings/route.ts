import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/client";
import { verifyBookingIdentity } from "@/lib/auth/verify-booking-identity";
import { BookingError, createConfirmedBooking } from "@/lib/bookings/create-booking";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let identity: Awaited<ReturnType<typeof verifyBookingIdentity>>;
  try {
    identity = await verifyBookingIdentity(request.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "خدمة المصادقة غير مجهزة" }, { status: 503, headers: noStore });
  }
  if (!identity)
    return NextResponse.json({ error: "يلزم تسجيل دخول موثوق" }, { status: 401, headers: noStore });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json({ error: "المحتوى يجب أن يكون JSON" }, { status: 415, headers: noStore });
  let data: unknown;
  try { data = await request.json(); } catch {
    return NextResponse.json({ error: "JSON غير صالح" }, { status: 400, headers: noStore });
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    return NextResponse.json({ error: "بيانات الحجز غير صالحة" }, { status: 400, headers: noStore });
  const values = data as Record<string, unknown>;
  // Reject even an apparently harmless tenant_id supplied by the caller.
  const allowed = ["unit_id", "customer_name", "customer_phone", "expires_at"];
  if (Object.keys(values).some(k => !allowed.includes(k)))
    return NextResponse.json({ error: "حقول غير مدعومة أو محاولة تجاوز هوية الشركة" }, { status: 400, headers: noStore });
  const unitId = values.unit_id;
  const name = values.customer_name;
  const phone = values.customer_phone;
  if (typeof unitId !== "string" || !UUID.test(unitId) ||
      typeof name !== "string" || name.trim().length < 1 || name.trim().length > 200 ||
      typeof phone !== "string" || phone.trim().length < 6 || phone.trim().length > 30) {
    return NextResponse.json({ error: "بيانات الوحدة أو العميل غير صالحة" }, { status: 400, headers: noStore });
  }
  let expiresAt: Date | null = null;
  if (values.expires_at !== undefined && values.expires_at !== null) {
    if (typeof values.expires_at !== "string" ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.test(values.expires_at)) {
      return NextResponse.json({ error: "تاريخ انتهاء الحجز غير صالح" }, { status: 400, headers: noStore });
    }
    expiresAt = new Date(values.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "يجب أن يكون تاريخ الانتهاء في المستقبل" }, { status: 400, headers: noStore });
    }
  }
  try {
    const result = await createConfirmedBooking(getDatabase(), {
      tenantId: identity.tenantId,
      externalAuthId: identity.externalAuthId,
      unitId,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      expiresAt,
    });
    return NextResponse.json(result, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof BookingError)
      return NextResponse.json({ code: error.code, error: error.message }, { status: error.httpStatus, headers: noStore });
    // A unique constraint is a second line of defence; the whole transaction was rolled back.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505")
      return NextResponse.json({ code: "UNIT_UNAVAILABLE", error: "الوحدة محجوزة بالفعل" }, { status: 409, headers: noStore });
    console.error("Booking transaction failed", error instanceof Error ? error.name : "database-error");
    return NextResponse.json({ error: "تعذر إتمام الحجز" }, { status: 500, headers: noStore });
  }
}
