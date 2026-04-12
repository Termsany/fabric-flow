import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { productionOrderStatusSchema } from "./domain-constraints";

export const productionOrdersTable = pgTable("production_orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  orderNumber: text("order_number").notNull(),
  fabricType: text("fabric_type").notNull(),
  gsm: real("gsm").notNull(),
  width: real("width").notNull(),
  rawColor: text("raw_color").notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status").notNull().default("PENDING"),
  notes: text("notes"),
  rollsGenerated: integer("rolls_generated").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  productionOrdersTenantIdx: index("production_orders_tenant_id_idx").on(table.tenantId),
}));

export const insertProductionOrderSchema = createInsertSchema(productionOrdersTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    orderNumber: z.string().trim().min(1).max(120),
    fabricType: z.string().trim().min(1).max(120),
    rawColor: z.string().trim().min(1).max(120),
    status: productionOrderStatusSchema.default("PENDING"),
  });
export type InsertProductionOrder = z.infer<typeof insertProductionOrderSchema>;
export type ProductionOrder = typeof productionOrdersTable.$inferSelect;
