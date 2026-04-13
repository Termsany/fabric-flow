import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull().default("info"),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  notificationsTenantIdx: index("notifications_tenant_id_idx").on(table.tenantId),
  notificationsReadIdx: index("notifications_read_idx").on(table.tenantId, table.isRead),
}));

export const insertNotificationSchema = createInsertSchema(notificationsTable)
  .omit({ id: true, createdAt: true, readAt: true })
  .extend({
    type: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(500),
    severity: z.enum(["info", "warning", "critical"]).default("info"),
  });

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
