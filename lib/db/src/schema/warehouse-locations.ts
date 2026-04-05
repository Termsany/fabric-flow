import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { warehousesTable } from "./warehouses";

export const warehouseLocationsTable = pgTable("warehouse_locations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  warehouseId: integer("warehouse_id").notNull().references(() => warehousesTable.id),
  code: text("code").notNull(),
  rack: text("rack").notNull(),
  level: text("level"),
  section: text("section"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWarehouseLocationSchema = createInsertSchema(warehouseLocationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWarehouseLocation = z.infer<typeof insertWarehouseLocationSchema>;
export type WarehouseLocation = typeof warehouseLocationsTable.$inferSelect;
