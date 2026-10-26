import {
  pgTable, pgEnum, uuid, text, boolean, timestamp, uniqueIndex,
  numeric, jsonb, unique, index, foreignKey, check, integer, date,
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
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.tenantId),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: userRole("role").notNull(),
  externalAuthId: text("external_auth_id"),
  passwordHash: text("password_hash"),
  isActive: boolean("is_active").notNull().default(true),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  authVersion: integer("auth_version").notNull().default(1),
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

export const customers = pgTable("customers", {
 id:uuid("id").primaryKey().defaultRandom(),
 tenantId:uuid("tenant_id").notNull().references(()=>tenants.tenantId,{onDelete:"restrict"}),
 fullName:text("full_name").notNull(),
 phonePrimary:text("phone_primary").notNull(),
 phoneSecondary:text("phone_secondary"),
 email:text("email"),
 nationalId:text("national_id"),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
 unique("customers_tenant_id_id_unique").on(t.tenantId,t.id),
 uniqueIndex("customers_tenant_phone_unique").on(t.tenantId,t.phonePrimary),
 index("customers_tenant_name_idx").on(t.tenantId,t.fullName),
 check("customers_name_valid",sql`length(btrim(${t.fullName})) BETWEEN 2 AND 200`),
 check("customers_phone_valid",sql`length(btrim(${t.phonePrimary})) BETWEEN 6 AND 30`),
]);

export const bookingStatus = pgEnum("booking_status", ["PENDING","CONFIRMED","CANCELLED"]);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.tenantId, { onDelete: "restrict" }),
  unitId: uuid("unit_id").notNull(),
  status: bookingStatus("status").notNull().default("PENDING"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerId: uuid("customer_id"),
  bookingDate: timestamp("booking_date", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => [
  foreignKey({
    name: "bookings_unit_tenant_fk",
    columns: [table.tenantId, table.unitId],
    foreignColumns: [units.tenantId, units.id],
  }).onDelete("restrict"),
  foreignKey({name:"bookings_tenant_customer_fk",columns:[table.tenantId,table.customerId],foreignColumns:[customers.tenantId,customers.id]}).onDelete("restrict"),
  index("bookings_tenant_customer_idx").on(table.tenantId,table.customerId),
  index("bookings_tenant_unit_status_idx").on(table.tenantId, table.unitId, table.status),
  uniqueIndex("bookings_one_active_per_unit_idx").on(table.tenantId, table.unitId)
    .where(sql`${table.status} IN ('PENDING','CONFIRMED')`),
  check("bookings_customer_name_check", sql`length(btrim(${table.customerName})) BETWEEN 1 AND 200`),
  check("bookings_customer_phone_check", sql`length(btrim(${table.customerPhone})) BETWEEN 6 AND 30`),
  check("bookings_expires_after_creation_check",
    sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.bookingDate}`),
  uniqueIndex("bookings_tenant_id_id_key").on(table.tenantId, table.id),
]);

export const contractStatus = pgEnum("contract_status", ["DRAFT","ACTIVE","CANCELLED"]);
export const installmentStatus = pgEnum("installment_status", ["PENDING","PAID","OVERDUE"]);

export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(()=>tenants.tenantId,{onDelete:"restrict"}),
  bookingId: uuid("booking_id").notNull(),
  totalAmount: numeric("total_amount",{precision:12,scale:2}).notNull(),
  unitPriceSnapshot: numeric("unit_price_snapshot",{precision:12,scale:2}).notNull(),
  paymentPlanSnapshot: jsonb("payment_plan_snapshot").$type<{
    downPaymentPercent:string; installmentCount:number; intervalMonths:number;
  }>().notNull(),
  status: contractStatus("status").notNull().default("DRAFT"),
  signedAt: timestamp("signed_at",{withTimezone:true}),
  generatedDocxUrl:text("generated_docx_url"),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
}, table=>[
  unique("contracts_tenant_id_id_key").on(table.tenantId,table.id),
  unique("contracts_tenant_booking_unique").on(table.tenantId,table.bookingId),
  foreignKey({name:"contracts_booking_tenant_fk",
    columns:[table.tenantId,table.bookingId],
    foreignColumns:[bookings.tenantId,bookings.id],
  }).onDelete("restrict"),
  index("contracts_tenant_status_idx").on(table.tenantId,table.status),
  check("contracts_total_positive",sql`${table.totalAmount} > 0`),
  check("contracts_snapshot_positive",sql`${table.unitPriceSnapshot} > 0`),
  check("contracts_active_requires_signed_at_check",
    sql`${table.status} <> 'ACTIVE' OR ${table.signedAt} IS NOT NULL`),
  check("contracts_plan_object_check",
    sql`jsonb_typeof(${table.paymentPlanSnapshot}) = 'object'`),
]);

export const installments = pgTable("installments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(()=>tenants.tenantId,{onDelete:"restrict"}),
  contractId: uuid("contract_id").notNull(),
  sequence: integer("sequence").notNull(),
  isDownPayment: boolean("is_down_payment").notNull().default(false),
  dueDate: date("due_date").notNull(),
  amount: numeric("amount",{precision:12,scale:2}).notNull(),
  status: installmentStatus("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
}, table=>[
  foreignKey({name:"installments_contract_tenant_fk",
    columns:[table.tenantId,table.contractId],
    foreignColumns:[contracts.tenantId,contracts.id],
  }).onDelete("restrict"),
  unique("installments_contract_sequence_unique").on(table.tenantId,table.contractId,table.sequence),
  index("installments_tenant_due_status_idx").on(table.tenantId,table.dueDate,table.status),
  index("installments_tenant_contract_idx").on(table.tenantId,table.contractId),
  check("installments_sequence_positive",sql`${table.sequence} > 0`),
  check("installments_amount_positive",sql`${table.amount} > 0`),
  unique("installments_tenant_contract_id_unique").on(table.tenantId,table.contractId,table.id),
]);

export const paymentMethod = pgEnum("payment_method", ["CASH","BANK_TRANSFER","CHEQUE"]);

export const chequeClearanceStatusEnum=pgEnum("cheque_clearance_status_enum",["PENDING","CLEARED","BOUNCED"]);
export const receipts = pgTable("receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.tenantId, {onDelete:"restrict"}),
  contractId: uuid("contract_id").notNull(),
  installmentId: uuid("installment_id"),
  // Drizzle returns money as string. Never perform currency arithmetic with JS floats.
  amount: numeric("amount", {precision:12,scale:2}).notNull(),
  method: paymentMethod("method").notNull(),
  referenceNumber: text("reference_number"),
  chequeClearanceStatus:chequeClearanceStatusEnum("cheque_clearance_status").default("CLEARED"),
  bouncedReason:text("bounced_reason"),
  bouncedAt:timestamp("bounced_at",{withTimezone:true}),
  receiptDate: date("receipt_date").notNull(),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
}, table=>[
  foreignKey({name:"receipts_tenant_contract_fk",
    columns:[table.tenantId,table.contractId],
    foreignColumns:[contracts.tenantId,contracts.id],
  }).onDelete("restrict"),
  foreignKey({name:"receipts_tenant_contract_installment_fk",
    columns:[table.tenantId,table.contractId,table.installmentId],
    foreignColumns:[installments.tenantId,installments.contractId,installments.id],
  }).onDelete("restrict"),
  index("receipts_tenant_contract_date_idx").on(table.tenantId,table.contractId,table.receiptDate),
  index("receipts_tenant_installment_idx").on(table.tenantId,table.installmentId),
  unique("receipts_tenant_id_id_unique").on(table.tenantId,table.id),
  uniqueIndex("receipts_tenant_method_reference_unique").on(table.tenantId,table.method,table.referenceNumber)
    .where(sql`${table.method} <> 'CASH' AND ${table.referenceNumber} IS NOT NULL`),
  check("receipts_amount_positive",sql`${table.amount} > 0`),
  check("receipts_reference_required_check",
    sql`${table.method} = 'CASH' OR (${table.referenceNumber} IS NOT NULL AND length(btrim(${table.referenceNumber})) > 0)`),
]);

export const contractTemplates=pgTable("contract_templates",{
 id:uuid("id").primaryKey().defaultRandom(),
 tenantId:uuid("tenant_id").notNull().references(()=>tenants.tenantId,{onDelete:"restrict"}),
 name:text("name").notNull(),
 fileUrl:text("file_url").notNull(),
 isActive:boolean("is_active").notNull().default(true),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[unique("contract_templates_tenant_id_id_key").on(t.tenantId,t.id),index("contract_templates_tenant_active_idx").on(t.tenantId,t.isActive)]);

export const receiptChequeEvents=pgTable("receipt_cheque_events",{
 id:uuid("id").primaryKey().defaultRandom(),
 tenantId:uuid("tenant_id").notNull(),
 receiptId:uuid("receipt_id").notNull(),
 newStatus:chequeClearanceStatusEnum("new_status").notNull(),
 reason:text("reason"),
 recordedAt:timestamp("recorded_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
 unique("receipt_cheque_one_resolution").on(t.tenantId,t.receiptId),
 foreignKey({name:"receipt_cheque_events_scope_fk",columns:[t.tenantId,t.receiptId],foreignColumns:[receipts.tenantId,receipts.id]}).onDelete("restrict"),
 index("receipt_cheque_events_tenant_idx").on(t.tenantId,t.recordedAt),
]);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.tenantId),
  email: text("email").notNull(),
  role: userRole("role").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", {withTimezone:true}).notNull(),
  usedAt: timestamp("used_at", {withTimezone:true}),
  revokedAt: timestamp("revoked_at", {withTimezone:true}),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id:uuid("id").primaryKey().defaultRandom(),
  tenantId:uuid("tenant_id").notNull().references(()=>tenants.tenantId),
  userId:uuid("user_id").references(()=>users.id),
  action:text("action").notNull(),
  entityType:text("entity_type").notNull(),
  entityId:uuid("entity_id").notNull(),
  oldValues:jsonb("old_values").$type<Record<string,unknown>|null>(),
  newValues:jsonb("new_values").$type<Record<string,unknown>|null>(),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});
