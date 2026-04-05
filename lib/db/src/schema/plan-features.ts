import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { plansTable } from "./plans";

export const planFeaturesTable = pgTable("plan_features", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  featureKey: text("feature_key").notNull(),
  labelAr: text("label_ar").notNull(),
  labelEn: text("label_en").notNull(),
  included: boolean("included").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlanFeatureSchema = createInsertSchema(planFeaturesTable).omit({ id: true, createdAt: true });
export type InsertPlanFeature = z.infer<typeof insertPlanFeatureSchema>;
export type PlanFeature = typeof planFeaturesTable.$inferSelect;
