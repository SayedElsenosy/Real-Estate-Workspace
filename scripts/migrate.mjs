import "node:process";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DATABASE_URL_ADMIN;
if (!url) throw new Error("DATABASE_URL_ADMIN required for migrations; NEVER use admin credentials in runtime");
const db = postgres(url, { max: 1, prepare: false });
const files = ["0001_foundation.sql", "0002_inventory.sql", "0003_bookings.sql", "0004_contracts.sql", "0005_receipts.sql", "0006_customers.sql", "0007_contract_templates.sql", "0008_template_binary_storage.sql", "0009_cheque_tracking.sql", "0010_cheque_lifecycle.sql", "0011_secure_receipts.sql", "0012_auth.sql"];
try {
  for (const file of files) {
    const script = await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8");
    await db.unsafe(script);
    console.log(`Applied/verified ${file}`);
  }
} finally {
  await db.end();
}
