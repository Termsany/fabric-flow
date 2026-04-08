import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { planPricesTable } from "./plan-prices";
import { plansTable } from "./plans";
import { tenantsTable } from "./tenants";
import { billingStatusSchema } from "./domain-constraints";

export const tenantSubscriptionsTable = pgTable("tenant_subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => plansTable.id),
  planPriceId: integer("plan_price_id").references(() => planPricesTable.id),
  amount: integer("amount"),
  status: text("status").notNull().default("trialing"),
  paymentProvider: text("payment_provider"),
  paymentMethodCode: text("payment_method_code"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  tenantSubscriptionsTenantUnique: uniqueIndex("tenant_subscriptions_tenant_unique").on(table.tenantId),
}));

export const insertTenantSubscriptionSchema = createInsertSchema(tenantSubscriptionsTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    status: billingStatusSchema.default("trialing"),
    amount: z.number().int().nonnegative().nullable().optional(),
  });
export type InsertTenantSubscription = z.infer<typeof insertTenantSubscriptionSchema>;
export type TenantSubscription = typeof tenantSubscriptionsTable.$inferSelect;
