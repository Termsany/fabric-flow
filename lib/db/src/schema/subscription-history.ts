import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { platformAdminsTable } from "./platform-admins";
import { plansTable } from "./plans";
import { tenantSubscriptionsTable } from "./tenant-subscriptions";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const subscriptionHistoryTable = pgTable("subscription_history", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  tenantSubscriptionId: integer("tenant_subscription_id").references(() => tenantSubscriptionsTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  fromPlanId: integer("from_plan_id").references(() => plansTable.id),
  toPlanId: integer("to_plan_id").references(() => plansTable.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  actorUserId: integer("actor_user_id").references(() => usersTable.id),
  actorPlatformAdminId: integer("actor_platform_admin_id").references(() => platformAdminsTable.id),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubscriptionHistorySchema = createInsertSchema(subscriptionHistoryTable).omit({ id: true, createdAt: true });
export type InsertSubscriptionHistory = z.infer<typeof insertSubscriptionHistorySchema>;
export type SubscriptionHistory = typeof subscriptionHistoryTable.$inferSelect;
