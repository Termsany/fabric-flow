import test from "node:test";
import assert from "node:assert/strict";
import {
  assertDyeingTransitionAllowed,
  assertRollsCanEnterDyeing,
  buildDyeingWorkflowSummary,
  DyeingWorkflowError,
  formatDyeingOrderResponse,
} from "../src/routes/dyeing-orders.workflow";

function createRoll(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: 4,
    rollCode: `ROLL-${id}`,
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
    status: "QC_PASSED",
    qrCode: `ROLL-${id}`,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as never;
}

function createOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    tenantId: 4,
    orderNumber: "DYE-7",
    dyehouseName: "Cairo Dyehouse",
    targetColor: "Navy",
    targetShade: null,
    status: "PENDING",
    sentAt: null,
    receivedAt: null,
    notes: null,
    rollIds: [1, 2],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as never;
}

test("dyeing entry validation accepts tenant-owned QC-passed rolls", () => {
  assert.doesNotThrow(() => {
    assertRollsCanEnterDyeing([1, 2], [createRoll(1), createRoll(2)]);
  });
});

test("dyeing entry validation rejects orders without linked fabric rolls", () => {
  assert.throws(
    () => assertRollsCanEnterDyeing([], []),
    /at least one fabric roll/i,
  );
});

test("dyeing entry validation rejects missing tenant-owned rolls", () => {
  assert.throws(
    () => assertRollsCanEnterDyeing([1, 2], [createRoll(1)]),
    /do not belong to this tenant/i,
  );
});

test("dyeing entry validation rejects rolls that have not passed QC", () => {
  assert.throws(
    () => assertRollsCanEnterDyeing([1], [createRoll(1, { status: "QC_PENDING" })]),
    /QC-passed/i,
  );
});

test("dyeing transition validation allows completing linked dyeing orders", () => {
  assert.doesNotThrow(() => {
    assertDyeingTransitionAllowed(createOrder(), "COMPLETED");
  });
});

test("dyeing transition validation rejects completion without linked rolls", () => {
  assert.throws(
    () => assertDyeingTransitionAllowed(createOrder({ rollIds: [] }), "COMPLETED"),
    /without linked fabric rolls/i,
  );
});

test("dyeing transition validation rejects reopening completed dyeing orders", () => {
  assert.throws(
    () => assertDyeingTransitionAllowed(createOrder({ status: "COMPLETED" }), "IN_PROGRESS"),
    DyeingWorkflowError,
  );
});

test("dyeing workflow summary routes completed orders to warehouse", () => {
  const summary = buildDyeingWorkflowSummary(createOrder({ status: "COMPLETED" }));

  assert.equal(summary.currentState, "completed");
  assert.equal(summary.linkedRollCount, 2);
  assert.equal(summary.nextStep.route, "/warehouse");
});

test("dyeing response exposes linked rolls and next-step guidance", () => {
  const response = formatDyeingOrderResponse(createOrder(), [createRoll(1), createRoll(2)]);

  assert.deepEqual(response.linkedFabricRolls, [
    { id: 1, rollCode: "ROLL-1", status: "QC_PASSED", color: "White" },
    { id: 2, rollCode: "ROLL-2", status: "QC_PASSED", color: "White" },
  ]);
  assert.equal(response.workflow.currentState, "in_dyeing");
  assert.equal(response.workflow.nextStep.route, "/dyeing");
});
