import test from "node:test";
import assert from "node:assert/strict";
import { createWarehousesController } from "../src/modules/warehouses/warehouses.controller";
import { createMockRequest, createMockResponse } from "./helpers/http-mocks";

test("warehouses controller rejects invalid warehouse movement payloads with a consistent error shape", async () => {
  const controller = createWarehousesController({
    warehousesService: {
      listWarehouses: async () => [],
      createWarehouse: async () => ({ data: null as never }),
      getWarehouse: async () => null,
      updateWarehouse: async () => null,
      listWarehouseMovements: async () => [],
      createWarehouseMovement: async () => ({ data: null as never }),
    },
  });
  const req = createMockRequest({
    user: { userId: 9, tenantId: 4, role: "admin", email: "admin@example.com" },
    body: {
      fabricRollId: 15,
      fromWarehouseId: 3,
      toWarehouseId: 3,
      reason: "  internal move  ",
    },
  });
  const res = createMockResponse();

  await controller.createWarehouseMovement(req, res.response);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.jsonBody, {
    error: "toWarehouseId: fromWarehouseId and toWarehouseId must be different",
  });
});

test("warehouses controller returns a schema-shaped movement payload on success", async () => {
  const controller = createWarehousesController({
    warehousesService: {
      listWarehouses: async () => [],
      createWarehouse: async () => ({ data: null as never }),
      getWarehouse: async () => null,
      updateWarehouse: async () => null,
      listWarehouseMovements: async () => [],
      createWarehouseMovement: async () => ({
        data: {
          id: 70,
          tenantId: 4,
          fabricRollId: 15,
          fromWarehouseId: 3,
          toWarehouseId: 5,
          movedById: 9,
          reason: "Move to stock",
          movedAt: "2026-01-02T10:00:00.000Z",
          createdAt: "2026-01-02T10:00:00.000Z",
        },
      }),
    },
  });
  const req = createMockRequest({
    user: { userId: 9, tenantId: 4, role: "admin", email: "admin@example.com" },
    body: {
      fabricRollId: 15,
      fromWarehouseId: 3,
      toWarehouseId: 5,
      reason: "Move to stock",
    },
  });
  const res = createMockResponse();

  await controller.createWarehouseMovement(req, res.response);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.jsonBody, {
    id: 70,
    tenantId: 4,
    fabricRollId: 15,
    fromWarehouseId: 3,
    toWarehouseId: 5,
    movedById: 9,
    reason: "Move to stock",
    movedAt: "2026-01-02T10:00:00.000Z",
    createdAt: "2026-01-02T10:00:00.000Z",
  });
});
