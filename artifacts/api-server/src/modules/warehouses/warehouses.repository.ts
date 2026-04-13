import {
  auditLogsTable,
  db,
  fabricRollsTable,
  warehouseMovementsTable,
  warehousesTable,
} from "@workspace/db";
import { FABRIC_ROLL_WORKFLOW_STATUS } from "@workspace/api-zod";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { normalizeIdentifierSearch } from "../../utils/identifiers";

export type WarehouseRow = typeof warehousesTable.$inferSelect;
export type WarehouseInsert = typeof warehousesTable.$inferInsert;
export type WarehouseMovementRow = typeof warehouseMovementsTable.$inferSelect;
export type WarehouseMovementInsert = typeof warehouseMovementsTable.$inferInsert;
export type FabricRollRow = typeof fabricRollsTable.$inferSelect;
export type AuditLogInsert = typeof auditLogsTable.$inferInsert;
export type WarehouseStockRow = {
  warehouseId: number;
  name: string;
  location: string;
  capacity: number | null;
  currentStock: number;
};

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
    options: { fabricRollId?: number; warehouseId?: number; search?: string; limit: number; offset: number },
  ) {
    const conditions = [eq(warehouseMovementsTable.tenantId, tenantId)];
    if (options.fabricRollId) {
      conditions.push(eq(warehouseMovementsTable.fabricRollId, options.fabricRollId));
    }
    if (options.warehouseId) {
      conditions.push(eq(warehouseMovementsTable.toWarehouseId, options.warehouseId));
    }
    const identifierSearch = normalizeIdentifierSearch(options.search);
    if (identifierSearch) {
      const searchConditions = [ilike(warehouseMovementsTable.reason, identifierSearch.pattern)];
      if (identifierSearch.numericId != null) {
        searchConditions.push(eq(warehouseMovementsTable.id, identifierSearch.numericId));
        searchConditions.push(eq(warehouseMovementsTable.fabricRollId, identifierSearch.numericId));
        searchConditions.push(eq(warehouseMovementsTable.fromWarehouseId, identifierSearch.numericId));
        searchConditions.push(eq(warehouseMovementsTable.toWarehouseId, identifierSearch.numericId));
      }
      conditions.push(or(...searchConditions)!);
    }

    return db.select().from(warehouseMovementsTable)
      .where(and(...conditions))
      .orderBy(desc(warehouseMovementsTable.createdAt))
      .limit(options.limit)
      .offset(options.offset);
  },

  listWarehouseMovementsForTenant(tenantId: number) {
    return db.select({
      fabricRollId: warehouseMovementsTable.fabricRollId,
      fromWarehouseId: warehouseMovementsTable.fromWarehouseId,
      toWarehouseId: warehouseMovementsTable.toWarehouseId,
      movementType: warehouseMovementsTable.movementType,
      movedAt: warehouseMovementsTable.movedAt,
      createdAt: warehouseMovementsTable.createdAt,
    }).from(warehouseMovementsTable)
      .where(eq(warehouseMovementsTable.tenantId, tenantId))
      .orderBy(desc(warehouseMovementsTable.movedAt));
  },

  findFabricRollById(tenantId: number, id: number) {
    return db.select().from(fabricRollsTable).where(
      and(eq(fabricRollsTable.id, id), eq(fabricRollsTable.tenantId, tenantId)),
    );
  },

  createWarehouseMovement(values: WarehouseMovementInsert) {
    return db.insert(warehouseMovementsTable).values(values).returning();
  },

  updateFabricRollWarehouse(
    tenantId: number,
    fabricRollId: number,
    warehouseId: number | null,
    warehouseLocationId: number | null = null,
    status?: typeof fabricRollsTable.$inferInsert.status,
  ) {
    return db.update(fabricRollsTable).set({
      warehouseId,
      warehouseLocationId,
      ...(status ? { status } : {}),
    }).where(
      and(eq(fabricRollsTable.id, fabricRollId), eq(fabricRollsTable.tenantId, tenantId)),
    );
  },

  insertAuditLog(values: AuditLogInsert) {
    return db.insert(auditLogsTable).values(values);
  },

  listInventoryStatusCounts(tenantId: number) {
    return db.select({
      status: fabricRollsTable.status,
      count: count(),
    }).from(fabricRollsTable)
      .where(eq(fabricRollsTable.tenantId, tenantId))
      .groupBy(fabricRollsTable.status);
  },

  listWarehouseStock(tenantId: number) {
    return db.select({
      warehouseId: warehousesTable.id,
      name: warehousesTable.name,
      location: warehousesTable.location,
      capacity: warehousesTable.capacity,
      currentStock: sql<number>`count(${fabricRollsTable.id}) filter (where ${fabricRollsTable.status} in ('IN_STOCK', 'RESERVED'))`.mapWith(Number),
    }).from(warehousesTable)
      .leftJoin(
        fabricRollsTable,
        and(
          eq(fabricRollsTable.warehouseId, warehousesTable.id),
          eq(fabricRollsTable.tenantId, tenantId),
        ),
      )
      .where(eq(warehousesTable.tenantId, tenantId))
      .groupBy(warehousesTable.id)
      .orderBy(warehousesTable.name);
  },
};
