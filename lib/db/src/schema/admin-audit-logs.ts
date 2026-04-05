import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { platformAdminsTable } from "./platform-admins";

export const adminAuditLogsTable = pgTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  platformAdminId: integer("platform_admin_id").references(() => platformAdminsTable.id),
  adminEmail: text("admin_email").notNull(),
  adminRole: text("admin_role").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  targetTenantId: integer("target_tenant_id"),
  severity: text("severity").notNull().default("info"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogsTable).omit({ id: true, createdAt: true });
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;
export type AdminAuditLog = typeof adminAuditLogsTable.$inferSelect;
