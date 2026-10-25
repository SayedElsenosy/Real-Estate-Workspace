import {
  pgTable, pgEnum, uuid, text, boolean, timestamp, uniqueIndex,
  numeric, jsonb, unique, index, foreignKey, check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRole = pgEnum("app_user_role", ["PLATFORM_OWNER","COMPANY_ADMIN","SALES","ACCOUNTANT"]);
export const projectStatus = pgEnum("project_status", ["PLANNED","ACTIVE","ON_HOLD","COMPLETED"]);
export const unitStatus = pgEnum("unit_status", ["AVAILABLE","BOOKED","SOLD"]);

// Even the company directory has tenant_id: the row identifies its own company.
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
}, (table) => [
  uniqueIndex("users_tenant_email_ci_unique").on(table.tenantId, sql`lower(${table.email})`),
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.tenantId, {onDelete: "restrict"}),
  name: text("name").notNull(),
  location: text("location").notNull().default(""),
  status: projectStatus("status").notNull().default("PLANNED"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
}, (table) => [
  unique("projects_tenant_id_id_key").on(table.tenantId, table.id),
  index("projects_tenant_status_idx").on(table.tenantId, table.status),
  check("projects_name_nonempty", sql`length(btrim(${table.name})) > 0`),
]);

export const phases = pgTable("phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.tenantId, {onDelete: "restrict"}),
  projectId: uuid("project_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
}, (table) => [
  unique("phases_tenant_id_id_key").on(table.tenantId, table.id),
  unique("phases_project_name_key").on(table.tenantId, table.projectId, table.name),
  foreignKey({
    name: "phases_project_tenant_fk",
    columns: [table.tenantId, table.projectId],
    foreignColumns: [projects.tenantId, projects.id],
  }).onDelete("restrict"),
  index("phases_tenant_project_idx").on(table.tenantId, table.projectId),
  check("phases_name_nonempty", sql`length(btrim(${table.name})) > 0`),
]);

export const buildings = pgTable("buildings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.tenantId, {onDelete: "restrict"}),
  phaseId: uuid("phase_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
}, (table) => [
  unique("buildings_tenant_id_id_key").on(table.tenantId, table.id),
  unique("buildings_phase_name_key").on(table.tenantId, table.phaseId, table.name),
  foreignKey({
    name: "buildings_phase_tenant_fk",
    columns: [table.tenantId, table.phaseId],
    foreignColumns: [phases.tenantId, phases.id],
  }).onDelete("restrict"),
  index("buildings_tenant_phase_idx").on(table.tenantId, table.phaseId),
  check("buildings_name_nonempty", sql`length(btrim(${table.name})) > 0`),
]);

export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.tenantId, {onDelete: "restrict"}),
  buildingId: uuid("building_id").notNull(),
  unitNumber: text("unit_number").notNull(),
  // Decimal is represented as a string by Drizzle; NEVER convert money to JS Number.
  area: numeric("area", {precision: 12, scale: 2}).notNull(),
  price: numeric("price", {precision: 12, scale: 2}).notNull(),
  status: unitStatus("status").notNull().default("AVAILABLE"),
  // Null until an actual plan geometry has been reviewed; no invented coordinates.
  svgCoordinates: jsonb("svg_coordinates").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
}, (table) => [
  unique("units_tenant_id_id_key").on(table.tenantId, table.id),
  unique("units_building_number_key").on(table.tenantId, table.buildingId, table.unitNumber),
  foreignKey({
    name: "units_building_tenant_fk",
    columns: [table.tenantId, table.buildingId],
    foreignColumns: [buildings.tenantId, buildings.id],
  }).onDelete("restrict"),
  index("units_tenant_building_status_idx").on(table.tenantId, table.buildingId, table.status),
  check("units_unit_number_nonempty", sql`length(btrim(${table.unitNumber})) > 0`),
  check("units_area_positive", sql`${table.area} > 0`),
  check("units_price_nonnegative", sql`${table.price} >= 0`),
  check("units_svg_coordinates_object_check",
    sql`${table.svgCoordinates} IS NULL OR jsonb_typeof(${table.svgCoordinates}) = 'object'`),
]);

export const bookingStatus = pgEnum("booking_status", ["PENDING","CONFIRMED","CANCELLED"]);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.tenantId, { onDelete: "restrict" }),
  unitId: uuid("unit_id").notNull(),
  status: bookingStatus("status").notNull().default("PENDING"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  bookingDate: timestamp("booking_date", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => [
  foreignKey({
    name: "bookings_unit_tenant_fk",
    columns: [table.tenantId, table.unitId],
    foreignColumns: [units.tenantId, units.id],
  }).onDelete("restrict"),
  index("bookings_tenant_unit_status_idx").on(table.tenantId, table.unitId, table.status),
  uniqueIndex("bookings_one_active_per_unit_idx").on(table.tenantId, table.unitId)
    .where(sql`${table.status} IN ('PENDING','CONFIRMED')`),
  check("bookings_customer_name_check", sql`length(btrim(${table.customerName})) BETWEEN 1 AND 200`),
  check("bookings_customer_phone_check", sql`length(btrim(${table.customerPhone})) BETWEEN 6 AND 30`),
  check("bookings_expires_after_creation_check",
    sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.bookingDate}`),
]);
