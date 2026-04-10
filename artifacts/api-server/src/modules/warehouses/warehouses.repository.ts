import {
  auditLogsTable,
  db,
  fabricRollsTable,
  warehouseMovementsTable,
  warehousesTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

export type WarehouseRow = typeof warehousesTable.$inferSelect;
export type WarehouseInsert = typeof warehousesTable.$inferInsert;
export type WarehouseMovementRow = typeof warehouseMovementsTable.$inferSelect;
export type WarehouseMovementInsert = typeof warehouseMovementsTable.$inferInsert;
export type FabricRollRow = typeof fabricRollsTable.$inferSelect;
export type AuditLogInsert = typeof auditLogsTable.$inferInsert;

export const warehousesRepository = {
  listWarehouses(tenantId: number) {
    return db.select().from(warehousesTable)
      .where(eq(warehousesTable.tenantId, tenantId))
      .orderBy(warehousesTable.name);
  },

  createWarehouse(values: WarehouseInsert) {
    return db.insert(warehousesTable).values(values).returning();
  },

  findWarehouseById(tenantId: number, id: number) {
    return db.select().from(warehousesTable).where(
      and(eq(warehousesTable.id, id), eq(warehousesTable.tenantId, tenantId)),
    );
  },

  updateWarehouse(tenantId: number, id: number, updates: Record<string, unknown>) {
    return db.update(warehousesTable).set(updates).where(
      and(eq(warehousesTable.id, id), eq(warehousesTable.tenantId, tenantId)),
    ).returning();
  },

  listWarehouseMovements(
    tenantId: number,
    options: { fabricRollId?: number; warehouseId?: number; limit: number; offset: number },
  ) {
    const conditions = [eq(warehouseMovementsTable.tenantId, tenantId)];
    if (options.fabricRollId) {
      conditions.push(eq(warehouseMovementsTable.fabricRollId, options.fabricRollId));
    }
    if (options.warehouseId) {
      conditions.push(eq(warehouseMovementsTable.toWarehouseId, options.warehouseId));
    }

    return db.select().from(warehouseMovementsTable)
      .where(and(...conditions))
      .orderBy(desc(warehouseMovementsTable.createdAt))
      .limit(options.limit)
      .offset(options.offset);
  },

  findFabricRollById(tenantId: number, id: number) {
    return db.select().from(fabricRollsTable).where(
      and(eq(fabricRollsTable.id, id), eq(fabricRollsTable.tenantId, tenantId)),
    );
  },

  createWarehouseMovement(values: WarehouseMovementInsert) {
    return db.insert(warehouseMovementsTable).values(values).returning();
  },

  updateFabricRollWarehouse(tenantId: number, fabricRollId: number, warehouseId: number | null) {
    return db.update(fabricRollsTable).set({
      warehouseId,
      status: "IN_STOCK",
    }).where(
      and(eq(fabricRollsTable.id, fabricRollId), eq(fabricRollsTable.tenantId, tenantId)),
    );
  },

  insertAuditLog(values: AuditLogInsert) {
    return db.insert(auditLogsTable).values(values);
  },
};
