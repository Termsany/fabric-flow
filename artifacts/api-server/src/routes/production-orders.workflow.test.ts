import test from "node:test";
import assert from "node:assert/strict";
import { formatProductionOrderResponse } from "./production-orders.workflow";

test("formatProductionOrderResponse prefers order batchId when available", () => {
  const order = {
    id: 1,
    tenantId: 10,
    orderNumber: "PO-1",
    batchId: "BATCH-ORDER",
    fabricType: "Cotton",
    gsm: 180,
    width: 160,
    rawColor: "White",
    quantity: 1,
    status: "IN_PROGRESS",
    notes: null,
    rollsGenerated: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const rolls = [{
    id: 11,
    tenantId: 10,
    rollCode: "ROLL-1",
    batchId: "BATCH-ROLL",
    productionOrderId: 1,
    warehouseId: null,
    warehouseLocationId: null,
    length: 25,
    weight: 12,
    color: "White",
    gsm: 180,
    width: 160,
    fabricType: "Cotton",
    status: "IN_PRODUCTION",
    qrCode: "ROLL-1",
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  }];

  const response = formatProductionOrderResponse(order, rolls);
  assert.equal(response.batchId, "BATCH-ORDER");
});

test("formatProductionOrderResponse falls back to roll batchId when order batchId is missing", () => {
  const order = {
    id: 2,
    tenantId: 10,
    orderNumber: "PO-2",
    batchId: null,
    fabricType: "Cotton",
    gsm: 180,
    width: 160,
    rawColor: "White",
    quantity: 1,
    status: "IN_PROGRESS",
    notes: null,
    rollsGenerated: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const rolls = [{
    id: 21,
    tenantId: 10,
    rollCode: "ROLL-2",
    batchId: "BATCH-ROLL-2",
    productionOrderId: 2,
    warehouseId: null,
    warehouseLocationId: null,
    length: 25,
    weight: 12,
    color: "White",
    gsm: 180,
    width: 160,
    fabricType: "Cotton",
    status: "IN_PRODUCTION",
    qrCode: "ROLL-2",
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  }];

  const response = formatProductionOrderResponse(order, rolls);
  assert.equal(response.batchId, "BATCH-ROLL-2");
});
