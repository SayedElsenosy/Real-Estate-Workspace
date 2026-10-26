import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./auth-schema";
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
/** Dedicated identity-only login, member of auth_runtime; NEVER an admin or tenant login. */
export function getAuthDatabase() {
 if (!database) {
  const url=process.env.AUTH_DATABASE_URL;
  if (!url) throw new Error("AUTH_DATABASE_URL is not configured");
  database=drizzle(postgres(url,{prepare:false,max:3}),{schema});
 }
 return database;
}
