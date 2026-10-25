import "server-only";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

let database: PostgresJsDatabase<typeof schema> | undefined;

/** Never use DATABASE_URL_ADMIN in request handlers. */
export function getDatabase(): PostgresJsDatabase<typeof schema> {
  if (!database) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL (restricted runtime login) is not configured");
    database = drizzle(postgres(url, { prepare: false, max: 5 }), { schema });
  }
  return database;
}

/**
 * Call ONLY after a trusted server-side authentication/tenant-membership check.
 * The tenant identity is transaction-local: it cannot leak through connection pooling.
 * A caller-supplied tenant ID must never be trusted as authentication.
 */
export async function withTenantTransaction<T>(
  verifiedTenantId: string,
  action: (transaction: Parameters<Parameters<PostgresJsDatabase<typeof schema>["transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(verifiedTenantId)) {
    throw new Error("Invalid tenant identifier");
  }
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('app.tenant_id', ${verifiedTenantId}, true)`);
    return action(transaction);
  });
}
