import test from "node:test";
import assert from "node:assert/strict";
import { createWarehouseMovementsUseCases } from "../src/modules/warehouses/warehouses.movements";

function createMovementUseCasesWithRoll(options: { status: string; warehouseId?: number | null }) {
  const auditLogs: unknown[] = [];
  const service = createWarehouseMovementsUseCases({
    ensureUsageWithinLimit: async () => ({ allowed: true, current: 0, limit: null }),
    warehousesRepository: {
      listWarehouses: async () => [],
      createWarehouse: async () => [],
      findWarehouseById: async () => [{
        id: 5,
        tenantId: 4,
        name: "Main",
        location: "A1",
        capacity: null,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }],
      updateWarehouse: async () => [],
      listWarehouseMovements: async () => [],
      findFabricRollById: async () => [{
        id: 1001,
        tenantId: 4,
        rollCode: "ROLL-1001",
        batchId: "BATCH-1",
        productionOrderId: 5,
        warehouseId: options.warehouseId ?? null,
        warehouseLocationId: null,
        length: 25,
        weight: 12,
        color: "White",
        gsm: 180,
        width: 160,
        fabricType: "Cotton",
        status: options.status,
        qrCode: "ROLL-1001",
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }],
      createWarehouseMovement: async (values) => [{
        id: 22,
        tenantId: values.tenantId,
        fabricRollId: values.fabricRollId,
        fromWarehouseId: values.fromWarehouseId ?? null,
        toWarehouseId: values.toWarehouseId ?? null,
        movedById: values.movedById,
        reason: values.reason ?? null,
        movedAt: values.movedAt ?? new Date("2026-01-02T00:00:00.000Z"),
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      }],
      updateFabricRollWarehouse: async () => undefined,
      insertAuditLog: async (values) => {
        auditLogs.push(values);
      },
      listInventoryStatusCounts: async () => [],
      listWarehouseStock: async () => [],
    },
  });

  return { service, auditLogs };
}

test("warehouse intake accepts QC-passed fabric rolls", async () => {
  const { service, auditLogs } = createMovementUseCasesWithRoll({ status: "QC_PASSED" });

  const result = await service.createWarehouseMovement(4, 11, {
    fabricRollId: 1001,
    toWarehouseId: 5,
  });

  assert.ok("data" in result);
  assert.equal(result.data.fabricRollId, 1001);
  assert.equal(result.data.toWarehouseId, 5);

  const [auditLog] = auditLogs as Array<{ action: string; changes: string }>;
  assert.equal(auditLog.action, "CREATE");
  assert.deepEqual(JSON.parse(auditLog.changes), {
    before: { fabricRollId: 1001, warehouseId: null, status: "QC_PASSED" },
    after: { fabricRollId: 1001, warehouseId: 5, status: "IN_STOCK" },
    context: {
      movementType: "inbound",
      fromWarehouseId: null,
      toWarehouseId: 5,
      reason: null,
    },
    reason: null,
  });
});

test("warehouse intake accepts dyeing-completed finished fabric rolls", async () => {
  const { service } = createMovementUseCasesWithRoll({ status: "FINISHED" });

  const result = await service.createWarehouseMovement(4, 11, {
    fabricRollId: 1001,
    toWarehouseId: 5,
  });

  assert.ok("data" in result);
  assert.equal(result.data.fabricRollId, 1001);
});

test("warehouse intake rejects fabric rolls without upstream readiness", async () => {
  const { service } = createMovementUseCasesWithRoll({ status: "QC_PENDING" });

  const result = await service.createWarehouseMovement(4, 11, {
    fabricRollId: 1001,
    toWarehouseId: 5,
  });

  assert.deepEqual(result, {
    error: "Fabric roll must pass QC or complete dyeing before warehouse intake",
    status: 400,
  });
});

test("warehouse intake rejects duplicate intake for rolls already in warehouse", async () => {
  const { service } = createMovementUseCasesWithRoll({ status: "IN_STOCK", warehouseId: 5 });

  const result = await service.createWarehouseMovement(4, 11, {
    fabricRollId: 1001,
    toWarehouseId: 5,
  });

  assert.deepEqual(result, {
    error: "Fabric roll is already in warehouse; provide fromWarehouseId for warehouse transfer",
    status: 400,
  });
});
