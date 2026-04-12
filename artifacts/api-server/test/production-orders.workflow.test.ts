import test from "node:test";
import assert from "node:assert/strict";
import {
  assertProductionOrderFabricRollLinks,
  buildProductionOrderWorkflowSummary,
  formatProductionOrderResponse,
  ProductionOrderFabricRollLinkError,
} from "../src/routes/production-orders.workflow";

function createOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    tenantId: 4,
    orderNumber: "PO-5",
    fabricType: "Cotton",
    gsm: 180,
    width: 160,
    rawColor: "White",
    quantity: 2,
    status: "IN_PROGRESS",
    notes: null,
    rollsGenerated: 2,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as never;
}

function createRoll(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: 4,
    rollCode: `PO-5-R${String(id).padStart(3, "0")}`,
    batchId: "BATCH-1",
    productionOrderId: 5,
    warehouseId: null,
    warehouseLocationId: null,
    length: 25,
    weight: 12,
    color: "White",
    gsm: 180,
    width: 160,
    fabricType: "Cotton",
    status: "IN_PRODUCTION",
    qrCode: `PO-5-R${String(id).padStart(3, "0")}`,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as never;
}

test("production order response exposes linked fabric roll information", () => {
  const response = formatProductionOrderResponse(createOrder(), [
    createRoll(1),
    createRoll(2),
  ]);

  assert.deepEqual(response.fabricRollIds, [1, 2]);
  assert.deepEqual(response.linkedFabricRolls, [
    { id: 1, rollCode: "PO-5-R001", status: "IN_PRODUCTION", color: "White", length: 25, weight: 12, warehouseId: null },
    { id: 2, rollCode: "PO-5-R002", status: "IN_PRODUCTION", color: "White", length: 25, weight: 12, warehouseId: null },
  ]);
  assert.equal(response.workflow.currentState, "production");
  assert.equal(response.workflow.nextStep.route, "/production-orders");
});

test("production order workflow summary surfaces downstream readiness", () => {
  const summary = buildProductionOrderWorkflowSummary([
    createRoll(1, { status: "QC_PENDING" }),
    createRoll(2, { status: "QC_PASSED" }),
    createRoll(3, { status: "IN_STOCK" }),
  ]);

  assert.equal(summary.currentState, "sales");
  assert.deepEqual(summary.readiness, {
    totalRolls: 3,
    readyForQc: 1,
    readyForDyeing: 1,
    readyForWarehouse: 0,
    readyForSales: 1,
    sold: 0,
  });
  assert.equal(summary.nextStep.route, "/sales");
});

test("production order link validation rejects orders without fabric rolls", () => {
  assert.throws(
    () => assertProductionOrderFabricRollLinks(createOrder(), []),
    ProductionOrderFabricRollLinkError,
  );
});

test("production order link validation rejects mismatched roll counts", () => {
  assert.throws(
    () => assertProductionOrderFabricRollLinks(createOrder({ rollsGenerated: 2 }), [createRoll(1)]),
    /roll count/i,
  );
});

test("production order link validation rejects tenant or order mismatches", () => {
  assert.throws(
    () => assertProductionOrderFabricRollLinks(createOrder(), [
      createRoll(1),
      createRoll(2, { productionOrderId: 99 }),
    ]),
    /invalid fabric roll link/i,
  );

  assert.throws(
    () => assertProductionOrderFabricRollLinks(createOrder(), [
      createRoll(1),
      createRoll(2, { tenantId: 99 }),
    ]),
    /invalid fabric roll link/i,
  );
});
