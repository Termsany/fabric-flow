import { boolean, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { plansTable } from "./plans";
import { planPriceIntervalSchema, supportedCurrencySchema } from "./domain-constraints";

export const planPricesTable = pgTable("plan_prices", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  interval: text("interval").notNull(),
  currency: text("currency").notNull().default("EGP"),
  amount: integer("amount").notNull(),
  trialDays: integer("trial_days").notNull().default(0),
  stripePriceId: text("stripe_price_id"),
  localPaymentEnabled: boolean("local_payment_enabled").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  planPricesUnique: uniqueIndex("plan_prices_plan_interval_unique").on(table.planId, table.interval),
}));

export const insertPlanPriceSchema = createInsertSchema(planPricesTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    interval: planPriceIntervalSchema,
    currency: supportedCurrencySchema.default("EGP"),
    amount: z.number().int().nonnegative(),
    trialDays: z.number().int().nonnegative().default(0),
  });
export type InsertPlanPrice = z.infer<typeof insertPlanPriceSchema>;
export type PlanPrice = typeof planPricesTable.$inferSelect;
