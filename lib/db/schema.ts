import { pgTable, pgEnum, uuid, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRole = pgEnum("app_user_role", ["PLATFORM_OWNER","COMPANY_ADMIN","SALES","ACCOUNTANT"]);

// Requirement: even the company directory uses tenant_id as its own primary key.
export const tenants = pgTable("tenants", {
  tenantId: uuid("tenant_id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isPlatformTenant: boolean("is_platform_tenant").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.tenantId),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: userRole("role").notNull(),
  externalAuthId: text("external_auth_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("users_tenant_email_ci_unique").on(table.tenantId, sql`lower(${table.email})`)]);
