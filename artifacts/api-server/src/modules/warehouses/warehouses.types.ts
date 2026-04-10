import { ensureUsageWithinLimit } from "../../lib/billing";
import {
  type AuditLogInsert,
  type FabricRollRow,
  type WarehouseInsert,
  type WarehouseMovementInsert,
  type WarehouseMovementRow,
  type WarehouseRow,
} from "./warehouses.repository";

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
  return {
    id: m.id,
    tenantId: m.tenantId,
    fabricRollId: m.fabricRollId,
    fromWarehouseId: m.fromWarehouseId ?? null,
    toWarehouseId: m.toWarehouseId ?? null,
    movedById: m.movedById,
    reason: m.reason ?? null,
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
      options: { fabricRollId?: number; warehouseId?: number; limit: number; offset: number },
    ) => Promise<WarehouseMovementRow[]>;
    findFabricRollById: (tenantId: number, id: number) => Promise<FabricRollRow[]>;
    createWarehouseMovement: (values: WarehouseMovementInsert) => Promise<WarehouseMovementRow[]>;
    updateFabricRollWarehouse: (tenantId: number, fabricRollId: number, warehouseId: number | null) => Promise<unknown>;
    insertAuditLog: (values: AuditLogInsert) => Promise<unknown>;
  };
  ensureUsageWithinLimit: typeof ensureUsageWithinLimit;
};

export type {
  AuditLogInsert,
  FabricRollRow,
  WarehouseInsert,
  WarehouseMovementInsert,
  WarehouseMovementRow,
  WarehouseRow,
};
