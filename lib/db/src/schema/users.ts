import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { userRoleSchema } from "./domain-constraints";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("production"), // admin, production, qc, warehouse, sales
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  passwordUpdatedAt: timestamp("password_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  usersTenantIdx: index("users_tenant_id_idx").on(table.tenantId),
}));

export const insertUserSchema = createInsertSchema(usersTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    email: z.string().trim().email().max(320),
    fullName: z.string().trim().min(1).max(200),
    role: userRoleSchema.default("production"),
  });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
