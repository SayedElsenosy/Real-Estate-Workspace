import assert from "node:assert/strict";
import postgres from "postgres";

// This probe must never execute on production or a persistent customer DB.
const url = process.env.DATABASE_URL_ADMIN;
if (!url || new URL(url).pathname !== "/foundation_test") {
  throw new Error("Append-only integration test requires disposable foundation_test");
}
const db = postgres(url, { max: 1, prepare: false });
try {
  const [receipt] = await db`SELECT id FROM public.receipts LIMIT 1`;
  const [event] = await db`SELECT id FROM public.receipt_cheque_events LIMIT 1`;
  assert.ok(receipt, "E2E must create a real receipt before append-only verification");
  assert.ok(event, "E2E must create a bounced cheque resolution event");
  const immutable = error => error && error.code === "P0001";

  await assert.rejects(
    db`UPDATE public.receipts SET reference_number=reference_number WHERE id=${receipt.id}`,
    immutable, "Even the migration role cannot UPDATE a posted receipt",
  );
  await assert.rejects(
    db`DELETE FROM public.receipts WHERE id=${receipt.id}`,
    immutable, "Even the migration role cannot DELETE a posted receipt",
  );
  await assert.rejects(
    db`UPDATE public.receipt_cheque_events SET reason=reason WHERE id=${event.id}`,
    immutable, "Cheque resolution events are immutable",
  );
  await assert.rejects(
    db`DELETE FROM public.receipt_cheque_events WHERE id=${event.id}`,
    immutable, "Cheque resolution events cannot be removed",
  );

  const [savedReceipt] = await db`SELECT id FROM public.receipts WHERE id=${receipt.id}`;
  const [savedEvent] = await db`SELECT id FROM public.receipt_cheque_events WHERE id=${event.id}`;
  assert.ok(savedReceipt && savedEvent, "Financial history must survive rejected mutations");
  console.log("PASS: real receipt and cheque event UPDATE/DELETE blocked by append-only triggers");
} finally {
  await db.end();
}
