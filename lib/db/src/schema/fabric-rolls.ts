import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { productionOrdersTable } from "./production-orders";
import { warehousesTable } from "./warehouses";
import { warehouseLocationsTable } from "./warehouse-locations";

export const fabricRollsTable = pgTable("fabric_rolls", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  rollCode: text("roll_code").notNull().unique(),
  batchId: text("batch_id").notNull(),
  productionOrderId: integer("production_order_id").notNull().references(() => productionOrdersTable.id),
  warehouseId: integer("warehouse_id").references(() => warehousesTable.id),
  warehouseLocationId: integer("warehouse_location_id").references(() => warehouseLocationsTable.id),
  length: real("length").notNull(), // meters
  weight: real("weight").notNull(), // kg
  color: text("color").notNull(),
  gsm: real("gsm").notNull(),
  width: real("width").notNull(), // cm
  fabricType: text("fabric_type").notNull(),
  status: text("status").notNull().default("CREATED"), // CREATED, IN_PRODUCTION, QC_PENDING, QC_PASSED, QC_FAILED, SENT_TO_DYEING, IN_DYEING, FINISHED, IN_STOCK, RESERVED, SOLD
  qrCode: text("qr_code").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFabricRollSchema = createInsertSchema(fabricRollsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFabricRoll = z.infer<typeof insertFabricRollSchema>;
export type FabricRoll = typeof fabricRollsTable.$inferSelect;
