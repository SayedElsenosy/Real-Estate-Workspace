import "node:process";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DATABASE_URL_ADMIN;
if (!url) throw new Error("DATABASE_URL_ADMIN required for schema migrations (never set in web runtime)");
const db = postgres(url, { max: 1, prepare: false });
try {
  const migration = await readFile(new URL("../db/migrations/0001_foundation.sql", import.meta.url), "utf8");
  await db.unsafe(migration);
  console.log("Stage 1 migration applied: tenants, users, forced RLS policies");
} finally {
  await db.end();
}
