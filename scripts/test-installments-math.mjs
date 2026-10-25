import assert from "node:assert/strict";
import Decimal from "decimal.js";
import { generateInstallments, PaymentPlanError } from "../lib/contracts/generate-installments.ts";

const exact = (rows) => rows.reduce(
  (sum, installment) => sum.plus(new Decimal(installment.amount)),
  new Decimal("0"),
).toFixed(2);

// User's cent-precision acceptance case: three payments and one extra piaster.
const rows = generateInstallments("1000000.01",new Date("2026-01-31T10:30:00.000Z"),{
  downPaymentPercent:"0",installmentCount:3,intervalMonths:3,
});
assert.equal(rows.length,3);
assert.deepEqual(rows.map(x=>x.amount),["333333.34","333333.34","333333.33"]);
assert.deepEqual(rows.map(x=>x.dueDate),["2026-04-30","2026-07-31","2026-10-31"]);
assert.equal(exact(rows),"1000000.01");
assert.ok(rows.every(x=>/^\d+\.\d{2}$/.test(x.amount)));

// Down payment 20%, followed by SIX quarterly installments.
const plan = generateInstallments("1000000.01",new Date("2026-01-31T00:00:00.000Z"),{
  downPaymentPercent:"20",installmentCount:6,intervalMonths:3,
});
assert.equal(plan.length,7);
assert.equal(plan[0].amount,"200000.00");
assert.equal(plan[0].dueDate,"2026-01-31");
assert.equal(plan[0].isDownPayment,true);
assert.equal(plan[1].dueDate,"2026-04-30");
assert.equal(exact(plan),"1000000.01");
assert.ok(plan.every(row=>new Decimal(row.amount).gt("0")));

// Fail closed: fraction below one piaster, invalid counts, non-decimal input.
assert.throws(()=>generateInstallments("0.02",new Date("2026-01-01"),{
  downPaymentPercent:"0",installmentCount:3,intervalMonths:1,
}),PaymentPlanError);
assert.throws(()=>generateInstallments("100.001",new Date("2026-01-01"),{
  downPaymentPercent:"0",installmentCount:3,intervalMonths:1,
}),PaymentPlanError);
assert.throws(()=>generateInstallments("100.00",new Date("2026-01-01"),{
  downPaymentPercent:"0",installmentCount:0,intervalMonths:1,
}),PaymentPlanError);
assert.throws(()=>generateInstallments("100.00",new Date("2026-01-01"),{
  downPaymentPercent:"100",installmentCount:3,intervalMonths:1,
}),PaymentPlanError);

console.log("PASS Decimal.js: 1000000.01 split into 333333.34 + 333333.34 + 333333.33; sum exact; 20%+6 quarterly exact");
