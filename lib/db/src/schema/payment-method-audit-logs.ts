import { pgTable, text, serial, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { platformAdminsTable } from "./platform-admins";

export const paymentMethodAuditLogsTable = pgTable("payment_method_audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id),
  actorPlatformAdminId: integer("actor_platform_admin_id").references(() => platformAdminsTable.id),
  actorName: text("actor_name").notNull(),
  actorRole: text("actor_role").notNull(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id),
  paymentMethodCode: text("payment_method_code").notNull(),
  action: text("action").notNull(),
  oldValues: jsonb("old_values").$type<Record<string, unknown> | null>(),
  newValues: jsonb("new_values").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  paymentMethodAuditTenantCreatedIdx: index("payment_method_audit_logs_tenant_created_idx").on(table.tenantId, table.createdAt),
  paymentMethodAuditCodeIdx: index("payment_method_audit_logs_code_idx").on(table.paymentMethodCode),
}));

export const insertPaymentMethodAuditLogSchema = createInsertSchema(paymentMethodAuditLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertPaymentMethodAuditLog = z.infer<typeof insertPaymentMethodAuditLogSchema>;
export type PaymentMethodAuditLog = typeof paymentMethodAuditLogsTable.$inferSelect;
