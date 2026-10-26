import { pgTable, uuid, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import { tenants, userRole } from "./schema";

// Adapter alias for the EXISTING users table; name maps to full_name, no second identity store.
export const authUsers = pgTable("users", {
 id: uuid("id").primaryKey().defaultRandom(),
 name: text("full_name").notNull(), email: text("email").notNull(),
 emailVerified: timestamp("email_verified", {withTimezone:true}), image: text("image"),
 tenantId: uuid("tenant_id").notNull().references(()=>tenants.tenantId),
 role: userRole("role").notNull(), externalAuthId: text("external_auth_id"),
 passwordHash: text("password_hash"), authVersion: integer("auth_version").notNull().default(1),
});
export const accounts = pgTable("accounts", {
 userId: uuid("user_id").notNull().references(()=>authUsers.id,{onDelete:"cascade"}),
 type: text("type").$type<AdapterAccountType>().notNull(), provider:text("provider").notNull(),
 providerAccountId:text("provider_account_id").notNull(), refresh_token:text("refresh_token"),
 access_token:text("access_token"), expires_at:integer("expires_at"), token_type:text("token_type"),
 scope:text("scope"), id_token:text("id_token"), session_state:text("session_state"),
},t=>[primaryKey({columns:[t.provider,t.providerAccountId]})]);
export const sessions = pgTable("sessions", {
 sessionToken:text("session_token").primaryKey(),
 userId:uuid("user_id").notNull().references(()=>authUsers.id,{onDelete:"cascade"}),
 expires:timestamp("expires",{withTimezone:true}).notNull(),
});
export const verificationTokens = pgTable("verification_tokens", {
 identifier:text("identifier").notNull(),token:text("token").notNull(),
 expires:timestamp("expires",{withTimezone:true}).notNull(),
},t=>[primaryKey({columns:[t.identifier,t.token]})]);
