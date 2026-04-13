import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { fabricRollsTable } from "./fabric-rolls";
import { warehousesTable } from "./warehouses";
import { usersTable } from "./users";

export const warehouseMovementsTable = pgTable("warehouse_movements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  fabricRollId: integer("fabric_roll_id").notNull().references(() => fabricRollsTable.id),
  fromWarehouseId: integer("from_warehouse_id").references(() => warehousesTable.id),
  toWarehouseId: integer("to_warehouse_id").references(() => warehousesTable.id),
  fromWarehouseLocationId: integer("from_warehouse_location_id"),
  toWarehouseLocationId: integer("to_warehouse_location_id"),
  movementType: text("movement_type"),
  movedById: integer("moved_by_id").notNull().references(() => usersTable.id),
  reason: text("reason"),
  movedAt: timestamp("moved_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWarehouseMovementSchema = createInsertSchema(warehouseMovementsTable).omit({ id: true, createdAt: true });
export type InsertWarehouseMovement = z.infer<typeof insertWarehouseMovementSchema>;
export type WarehouseMovement = typeof warehouseMovementsTable.$inferSelect;
