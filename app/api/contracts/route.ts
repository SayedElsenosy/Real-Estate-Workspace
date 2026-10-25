import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/client";
import { verifyRequestIdentity } from "@/lib/auth/mock-session";
import { ContractError, createSignedContract } from "@/lib/contracts/create-contract";
import { PaymentPlanError } from "@/lib/contracts/generate-installments";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECIMAL = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let identity: Awaited<ReturnType<typeof verifyRequestIdentity>>;
  try { identity = await verifyRequestIdentity(request); }
  catch { return NextResponse.json({error:"خدمة المصادقة غير مجهزة"},{status:503,headers:noStore}); }
  if (!identity) return NextResponse.json({error:"يلزم تسجيل دخول موثوق"},{status:401,headers:noStore});
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json({error:"المحتوى يجب أن يكون JSON"},{status:415,headers:noStore});
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({error:"JSON غير صالح"},{status:400,headers:noStore}); }
  if (!body || typeof body!=="object" || Array.isArray(body))
    return NextResponse.json({error:"بيانات العقد غير صالحة"},{status:400,headers:noStore});

  const data=body as Record<string,unknown>;
  if (Object.keys(data).some(k=>!["booking_id","total_amount","payment_plan"].includes(k)))
    return NextResponse.json({error:"حقول غير مسموحة؛ tenant_id يؤخذ من جلسة موثوقة فقط"},{status:400,headers:noStore});
  const p=data.payment_plan;
  if (typeof data.booking_id!=="string" || !UUID.test(data.booking_id) ||
      typeof data.total_amount!=="string" || !DECIMAL.test(data.total_amount) ||
      !p || typeof p!=="object" || Array.isArray(p))
    return NextResponse.json({error:"الحجز أو إجمالي العقد أو خطة السداد غير صالح"},{status:400,headers:noStore});
  const plan=p as Record<string,unknown>;
  if (Object.keys(plan).some(k=>!["down_payment_percent","installment_count","interval_months"].includes(k)) ||
      typeof plan.down_payment_percent!=="string" ||
      typeof plan.installment_count!=="number" || !Number.isSafeInteger(plan.installment_count) ||
      typeof plan.interval_months!=="number" || !Number.isSafeInteger(plan.interval_months))
    return NextResponse.json({error:"خطة السداد غير صالحة"},{status:400,headers:noStore});

  try {
    const result=await createSignedContract(getDatabase(),{
      tenantId:identity.tenantId, externalAuthId:identity.externalAuthId,
      bookingId:data.booking_id, totalAmount:data.total_amount,
      paymentPlan:{
        downPaymentPercent:plan.down_payment_percent,
        installmentCount:plan.installment_count,
        intervalMonths:plan.interval_months,
      },
    });
    return NextResponse.json(result,{status:201,headers:noStore});
  } catch(error) {
    if (error instanceof ContractError)
      return NextResponse.json({code:error.code,error:error.message},{status:error.httpStatus,headers:noStore});
    if (error instanceof PaymentPlanError)
      return NextResponse.json({code:"INVALID_PAYMENT_PLAN",error:error.message},{status:422,headers:noStore});
    if (typeof error==="object" && error!==null && "code" in error && error.code==="23505")
      return NextResponse.json({code:"CONTRACT_EXISTS",error:"يوجد عقد لهذا الحجز بالفعل"},{status:409,headers:noStore});
    console.error("Contract transaction failed",error instanceof Error?error.name:"database-error");
    return NextResponse.json({error:"تعذر إصدار العقد"},{status:500,headers:noStore});
  }
}
