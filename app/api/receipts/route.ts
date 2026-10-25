import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/client";
import { verifyRequestIdentity } from "@/lib/auth/mock-session";
import { PaymentError, recordPayment, type PaymentMethod } from "@/lib/finance/record-payment";
import { PaymentPlanError } from "@/lib/contracts/generate-installments";

export const runtime="nodejs";
const noStore={"Cache-Control":"no-store"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const decimal=/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const dateFormat=/^\d{4}-\d{2}-\d{2}$/;
const methods:ReadonlyArray<string>=["CASH","BANK_TRANSFER","CHEQUE"];
function validDate(value:string):boolean {
  if(!dateFormat.test(value)) return false;
  const parsed=new Date(value+"T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10)===value;
}
export async function POST(request:Request) {
  let identity:Awaited<ReturnType<typeof verifyRequestIdentity>>;
  try {identity=await verifyRequestIdentity(request);}
  catch {return NextResponse.json({error:"خدمة المصادقة غير مجهزة"},{status:503,headers:noStore});}
  if(!identity) return NextResponse.json({error:"يلزم تسجيل دخول موثوق"},{status:401,headers:noStore});
  if(!request.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json({error:"المحتوى يجب أن يكون JSON"},{status:415,headers:noStore});
  let raw:unknown;
  try {raw=await request.json();}
  catch {return NextResponse.json({error:"JSON غير صالح"},{status:400,headers:noStore});}
  if(!raw || typeof raw!=="object" || Array.isArray(raw))
    return NextResponse.json({error:"بيانات المقبوض غير صالحة"},{status:400,headers:noStore});
  const body=raw as Record<string,unknown>;
  const allowed=["contract_id","installment_id","amount","method","reference_number","receipt_date"];
  if(Object.keys(body).some(k=>!allowed.includes(k)))
    return NextResponse.json({error:"حقول غير مسموحة؛ هوية الشركة تؤخذ من JWT فقط"},{status:400,headers:noStore});
  if(typeof body.contract_id!=="string" || !uuid.test(body.contract_id) ||
     !(body.installment_id===undefined || body.installment_id===null ||
       (typeof body.installment_id==="string" && uuid.test(body.installment_id))) ||
     typeof body.amount!=="string" || !decimal.test(body.amount) ||
     typeof body.method!=="string" || !methods.includes(body.method) ||
     typeof body.receipt_date!=="string" || !validDate(body.receipt_date) ||
     !(body.reference_number===undefined || body.reference_number===null ||
       (typeof body.reference_number==="string" && body.reference_number.trim().length <= 150))) {
    return NextResponse.json({error:"حقول المقبوض غير صالحة"},{status:400,headers:noStore});
  }
  try {
    const result=await recordPayment(getDatabase(),{
      tenantId:identity.tenantId,
      externalAuthId:identity.externalAuthId,
      contractId:body.contract_id,
      installmentId:body.installment_id ?? null,
      amount:body.amount,
      method:body.method as PaymentMethod,
      referenceNumber:typeof body.reference_number==="string"?body.reference_number:null,
      receiptDate:body.receipt_date,
    });
    return NextResponse.json(result,{status:201,headers:noStore});
  } catch(error) {
    if(error instanceof PaymentError)
      return NextResponse.json({code:error.code,error:error.message},{status:error.httpStatus,headers:noStore});
    if(error instanceof PaymentPlanError)
      return NextResponse.json({code:"INVALID_AMOUNT",error:error.message},{status:422,headers:noStore});
    if (typeof error==="object" && error!==null && ("cause" in error || "code" in error) &&
        ((("code" in error) && error.code==="23505") ||
        (("cause" in error) && typeof error.cause==="object" && error.cause!==null &&
          "code" in error.cause && error.cause.code==="23505")))
      return NextResponse.json({code:"DUPLICATE_RECEIPT",error:"المقبوض مسجل بالفعل"},{status:409,headers:noStore});
    console.error("Receipt transaction failed",error instanceof Error?error.name:"database-error");
    return NextResponse.json({error:"تعذر تسجيل المقبوض"},{status:500,headers:noStore});
  }
}
