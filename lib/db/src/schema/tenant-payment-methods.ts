import { pgTable, text, serial, timestamp, integer, boolean, uniqueIndex, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { paymentMethodDefinitionsTable } from "./payment-method-definitions";

export const tenantPaymentMethodsTable = pgTable("tenant_payment_methods", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  paymentMethodCode: text("payment_method_code").notNull().references(() => paymentMethodDefinitionsTable.code),
  isActive: boolean("is_active").notNull().default(false),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  instructionsAr: text("instructions_ar"),
  instructionsEn: text("instructions_en"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  updatedBy: integer("updated_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  tenantMethodUnique: uniqueIndex("tenant_payment_methods_tenant_method_unique").on(table.tenantId, table.paymentMethodCode),
  tenantMethodTenantIdx: index("tenant_payment_methods_tenant_id_idx").on(table.tenantId),
  tenantMethodCodeIdx: index("tenant_payment_methods_payment_method_code_idx").on(table.paymentMethodCode),
}));

export const insertTenantPaymentMethodSchema = createInsertSchema(tenantPaymentMethodsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTenantPaymentMethod = z.infer<typeof insertTenantPaymentMethodSchema>;
export type TenantPaymentMethod = typeof tenantPaymentMethodsTable.$inferSelect;
