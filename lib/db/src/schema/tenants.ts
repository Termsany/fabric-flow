import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { billingStatusSchema, subscriptionIntervalSchema } from "./domain-constraints";

export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").notNull().default("textile"),
  country: text("country").notNull().default("Egypt"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  billingStatus: text("billing_status").notNull().default("trialing"),
  currentPlan: text("current_plan").notNull().default("basic"),
  subscriptionInterval: text("subscription_interval"),
  subscriptionEndsAt: timestamp("subscription_ends_at", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  lastInvoiceStatus: text("last_invoice_status"),
  maxUsersOverride: integer("max_users_override"),
  maxWarehousesOverride: integer("max_warehouses_override"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTenantSchema = createInsertSchema(tenantsTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: z.string().trim().min(1).max(200),
    industry: z.string().trim().min(1).max(120).default("textile"),
    country: z.string().trim().min(1).max(120).default("Egypt"),
    billingStatus: billingStatusSchema.default("trialing"),
    subscriptionInterval: subscriptionIntervalSchema.nullish(),
  });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
