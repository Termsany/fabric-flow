import { ensureUsageWithinLimit } from "../../lib/billing";
import { inferInventoryOperation, resolveInventoryOperation } from "./warehouses.inventory";
import {
  type AuditLogInsert,
  type FabricRollRow,
  type WarehouseStockRow,
  type WarehouseInsert,
  type WarehouseMovementInsert,
  type WarehouseMovementRow,
  type WarehouseRow,
} from "./warehouses.repository";
import type { InventoryStatusCount } from "./warehouses.reporting";

export function formatWarehouse(w: WarehouseRow) {
  return {
    id: w.id,
    tenantId: w.tenantId,
    name: w.name,
    location: w.location,
    capacity: w.capacity ?? null,
    isActive: w.isActive,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export function formatMovement(m: WarehouseMovementRow) {
  const resolvedOperation = resolveInventoryOperation(m);
  return {
    id: m.id,
    tenantId: m.tenantId,
    fabricRollId: m.fabricRollId,
    fromWarehouseId: m.fromWarehouseId ?? null,
    toWarehouseId: m.toWarehouseId ?? null,
    fromWarehouseLocationId: m.fromWarehouseLocationId ?? null,
    toWarehouseLocationId: m.toWarehouseLocationId ?? null,
    movedById: m.movedById,
    reason: m.reason ?? null,
    movementType: resolvedOperation ?? inferInventoryOperation(m),
    movedAt: m.movedAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
  };
}

export type WarehousesServiceDependencies = {
  warehousesRepository: {
    listWarehouses: (tenantId: number) => Promise<WarehouseRow[]>;
    createWarehouse: (values: WarehouseInsert) => Promise<WarehouseRow[]>;
    findWarehouseById: (tenantId: number, id: number) => Promise<WarehouseRow[]>;
    updateWarehouse: (tenantId: number, id: number, updates: Record<string, unknown>) => Promise<WarehouseRow[]>;
    listWarehouseMovements: (
      tenantId: number,
      options: { fabricRollId?: number; warehouseId?: number; search?: string; limit: number; offset: number },
    ) => Promise<WarehouseMovementRow[]>;
    listWarehouseMovementsForTenant: (
      tenantId: number,
    ) => Promise<Array<{
      fabricRollId: number;
      fromWarehouseId: number | null;
      toWarehouseId: number | null;
      movementType: string | null;
      movedAt: Date;
      createdAt: Date;
    }>>;
    findFabricRollById: (tenantId: number, id: number) => Promise<FabricRollRow[]>;
    createWarehouseMovement: (values: WarehouseMovementInsert) => Promise<WarehouseMovementRow[]>;
    updateFabricRollWarehouse: (
      tenantId: number,
      fabricRollId: number,
      warehouseId: number | null,
      warehouseLocationId?: number | null,
      status?: string,
    ) => Promise<unknown>;
    insertAuditLog: (values: AuditLogInsert) => Promise<unknown>;
    listInventoryStatusCounts: (tenantId: number) => Promise<InventoryStatusCount[]>;
    listWarehouseStock: (tenantId: number) => Promise<WarehouseStockRow[]>;
  };
  ensureUsageWithinLimit: typeof ensureUsageWithinLimit;
};

export type {
  AuditLogInsert,
  FabricRollRow,
  WarehouseStockRow,
  WarehouseInsert,
  WarehouseMovementInsert,
  WarehouseMovementRow,
  WarehouseRow,
};
