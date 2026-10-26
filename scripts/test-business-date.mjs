import assert from "node:assert/strict";
import {businessDate} from "../lib/utils/date.ts";
import {generateInstallments} from "../lib/contracts/generate-installments.ts";
assert.equal(businessDate(new Date("2026-01-01T22:30:00Z")),"2026-01-02");
assert.equal(businessDate(new Date("2026-10-25T22:30:00Z")),"2026-10-26");
assert.equal(businessDate("2026-10-25"),"2026-10-25");
const plan=generateInstallments("100.00",new Date("2026-01-30T22:30:00Z"),{
 downPaymentPercent:"20",installmentCount:2,intervalMonths:1,
});
assert.deepEqual(plan.map(x=>x.dueDate),["2026-01-31","2026-02-28","2026-03-31"]);
assert.deepEqual(plan.map(x=>x.amount),["20.00","40.00","40.00"]);
console.log("PASS Cairo rollover, date-only identity and Jan31 month-end installment schedule");
