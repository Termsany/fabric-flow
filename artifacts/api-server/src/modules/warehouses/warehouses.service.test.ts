import test from "node:test";
import assert from "node:assert/strict";
import { createWarehousesService } from "./warehouses.service";

test("warehousesService.createWarehouseMovement creates a movement and updates the roll location", async () => {
  const calls: Array<
    | { kind: "update-roll"; tenantId: number; fabricRollId: number; warehouseId: number | null }
    | { kind: "audit"; entityId: number; tenantId: number; userId: number }
  > = [];

  const service = createWarehousesService({
    warehousesRepository: {
      listWarehouses: async () => [],
      createWarehouse: async () => [],
      findWarehouseById: async (_tenantId, id) => [{
        id,
        tenantId: 4,
        name: id === 21 ? "Source" : "Destination",
        location: "A1",
        capacity: null,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }],
      updateWarehouse: async () => [],
      listWarehouseMovements: async () => [],
      listWarehouseMovementsForTenant: async () => [],
      findFabricRollById: async () => [{
        id: 15,
        tenantId: 4,
        rollCode: "ROLL-15",
        batchId: "BATCH-1",
        productionOrderId: 5,
        warehouseId: 21,
        warehouseLocationId: null,
        length: 25,
        weight: 12,
        color: "White",
        gsm: 180,
        width: 160,
        fabricType: "Cotton",
        status: "IN_STOCK",
        qrCode: "ROLL-15",
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }],
      createWarehouseMovement: async () => [{
        id: 70,
        tenantId: 4,
        fabricRollId: 15,
        fromWarehouseId: 21,
        toWarehouseId: 22,
        movedById: 9,
        reason: "Move to picking zone",
        movedAt: new Date("2026-01-02T10:00:00.000Z"),
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
      }],
      updateFabricRollWarehouse: async (tenantId, fabricRollId, warehouseId) => {
        calls.push({ kind: "update-roll", tenantId, fabricRollId, warehouseId });
      },
      insertAuditLog: async (values) => {
        const payload = values as { entityId: number; tenantId: number; userId: number };
        calls.push({
          kind: "audit",
          entityId: payload.entityId,
          tenantId: payload.tenantId,
          userId: payload.userId,
        });
      },
      listInventoryStatusCounts: async () => [],
      listWarehouseStock: async () => [],
    },
    ensureUsageWithinLimit: async () => ({ allowed: true, limit: 5, current: 1 }),
  });

  const result = await service.createWarehouseMovement(4, 9, {
    fabricRollId: 15,
    fromWarehouseId: 21,
    toWarehouseId: 22,
    reason: "Move to picking zone",
  });

  assert.ok("data" in result);
  assert.deepEqual(calls, [
    { kind: "update-roll", tenantId: 4, fabricRollId: 15, warehouseId: 22 },
    { kind: "audit", entityId: 70, tenantId: 4, userId: 9 },
  ]);
});

test("warehousesService.createWarehouse blocks creation when the tenant has reached the warehouse limit", async () => {
  const service = createWarehousesService({
    warehousesRepository: {
      listWarehouses: async () => [],
      createWarehouse: async () => {
        assert.fail("createWarehouse should not run when usage limit is exceeded");
      },
      findWarehouseById: async () => [],
      updateWarehouse: async () => [],
      listWarehouseMovements: async () => [],
      listWarehouseMovementsForTenant: async () => [],
      findFabricRollById: async () => [],
      createWarehouseMovement: async () => [],
      updateFabricRollWarehouse: async () => undefined,
      insertAuditLog: async () => undefined,
      listInventoryStatusCounts: async () => [],
      listWarehouseStock: async () => [],
    },
    ensureUsageWithinLimit: async () => ({ allowed: false, limit: 1, current: 1 }),
  });

  const result = await service.createWarehouse(4, {
    name: "Overflow Warehouse",
    location: "Remote",
  });

  assert.deepEqual(result, {
    error: "Warehouse limit reached for current subscription plan",
    current: 1,
    limit: 1,
  });
});
