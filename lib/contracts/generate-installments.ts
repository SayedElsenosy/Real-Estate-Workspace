import Decimal from "decimal.js";

// Money is NEVER converted to JavaScript Number / float; all arithmetic stays Decimal.
const Money = Decimal.clone({ precision: 32, rounding: Decimal.ROUND_HALF_UP });
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const PERCENT_PATTERN = /^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/;

export type PaymentPlan = {
  /** Decimal percentage encoded as a STRING, e.g. "20" (never JS number). */
  downPaymentPercent: string;
  /** Number of installments AFTER the down payment; when down=0, this is total count. */
  installmentCount: number;
  /** Number of calendar months between signing and each subsequent installment. */
  intervalMonths: number;
};

export type ScheduledInstallment = {
  sequence: number;
  dueDate: string; // YYYY-MM-DD in UTC
  amount: string; // exact 2-decimal fixed string
  isDownPayment: boolean;
};

export class PaymentPlanError extends Error {
  constructor(message: string) { super(message); this.name = "PaymentPlanError"; }
}

export function parsePositiveMoney(amount: string): Decimal {
  if (typeof amount !== "string" || !MONEY_PATTERN.test(amount))
    throw new PaymentPlanError("قيمة العقد يجب أن تكون نصًا عشريًا موجبًا بدقة قرش");
  const parsed = new Money(amount);
  if (!parsed.isFinite() || parsed.lte(0))
    throw new PaymentPlanError("قيمة العقد يجب أن تكون أكبر من صفر");
  return parsed;
}

function paymentDate(signedAt: Date, monthOffset: number): string {
  // Anchor every due date to the ORIGINAL signing day (Jan 31 -> Apr 30).
  const year = signedAt.getUTCFullYear();
  const month = signedAt.getUTCMonth() + monthOffset;
  const originalDay = signedAt.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const safeDay = originalDay > lastDay ? lastDay : originalDay;
  return new Date(Date.UTC(year, month, safeDay)).toISOString().slice(0, 10);
}

export function generateInstallments(
  totalAmount: string,
  signedAt: Date,
  plan: PaymentPlan,
): ScheduledInstallment[] {
  const total = parsePositiveMoney(totalAmount);
  if (!(signedAt instanceof Date) || Number.isNaN(signedAt.getTime()))
    throw new PaymentPlanError("تاريخ توقيع العقد غير صالح");
  if (!plan || !PERCENT_PATTERN.test(plan.downPaymentPercent))
    throw new PaymentPlanError("نسبة المقدم يجب أن تكون نصًا عشريًا من 0 إلى أقل من 100");
  if (!Number.isSafeInteger(plan.installmentCount) || plan.installmentCount < 1 || plan.installmentCount > 120)
    throw new PaymentPlanError("عدد الأقساط يجب أن يكون بين 1 و120");
  if (!Number.isSafeInteger(plan.intervalMonths) || plan.intervalMonths < 1 || plan.intervalMonths > 120)
    throw new PaymentPlanError("الفاصل الشهري يجب أن يكون بين 1 و120");

  const percentage = new Money(plan.downPaymentPercent);
  if (percentage.lt(0) || percentage.gte(100))
    throw new PaymentPlanError("نسبة المقدم يجب أن تكون أقل من 100");
  const down = total.times(percentage).div(100).toDecimalPlaces(2, Money.ROUND_HALF_UP);
  if (percentage.gt(0) && down.lt("0.01"))
    throw new PaymentPlanError("المقدم أصغر من قرش واحد");
  const remaining = total.minus(down);
  const count = plan.installmentCount;
  if (remaining.lt(new Money("0.01").times(count)))
    throw new PaymentPlanError("المبلغ المتبقي أقل من قرش لكل قسط");

  const result: ScheduledInstallment[] = [];
  if (down.gt(0)) result.push({
    sequence: 1, dueDate: paymentDate(signedAt, 0),
    amount: down.toFixed(2), isDownPayment: true,
  });

  // Round each regular installment HALF_UP; adjust ONLY the final installment.
  const regular = remaining.div(count).toDecimalPlaces(2, Money.ROUND_HALF_UP);
  if (regular.lte(0)) throw new PaymentPlanError("قيمة القسط غير صالحة");
  const last = remaining.minus(regular.times(new Money(count - 1)));
  if (last.lte(0)) throw new PaymentPlanError("القسط الأخير لا يمكن أن يكون صفرًا أو سالبًا");
  for (let i = 1; i <= count; i++) {
    const amount = i === count ? last : regular;
    result.push({
      sequence: result.length + 1,
      dueDate: paymentDate(signedAt, i * plan.intervalMonths),
      amount: amount.toFixed(2),
      isDownPayment: false,
    });
  }

  const sum = result.reduce((value, row) => value.plus(new Money(row.amount)), new Money("0"));
  if (!sum.eq(total)) throw new PaymentPlanError("مجموع الأقساط لا يساوي إجمالي العقد");
  return result;
}
