import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFabricRollDetailResponse,
  buildFabricRollWorkflowSummary,
  sortFabricRollTimeline,
} from "../src/routes/fabric-rolls.workflow";

test("fabric roll workflow summary directs QC-pending rolls to quality control", () => {
  const summary = buildFabricRollWorkflowSummary("QC_PENDING");

  assert.deepEqual(summary, {
    currentStatus: "QC_PENDING",
    currentStage: "quality_control",
    nextStep: {
      action: "Run quality control",
      description: "Create a QC report so the next workflow path becomes explicit.",
      route: "/quality-control",
    },
  });
});

test("fabric roll workflow summary directs finished rolls to warehouse", () => {
  const summary = buildFabricRollWorkflowSummary("FINISHED");

  assert.equal(summary.currentStatus, "FINISHED");
  assert.equal(summary.currentStage, "warehouse");
  assert.equal(summary.nextStep.route, "/warehouse");
});

test("fabric roll detail response includes explicit workflow and traceability blocks", () => {
  const response = buildFabricRollDetailResponse(
    {
      id: 15,
      tenantId: 4,
      rollCode: "ROLL-15",
      batchId: "BATCH-1",
      productionOrderId: 5,
      warehouseId: 2,
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
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
    {
      productionOrder: { id: 5, orderNumber: "PO-5", status: "IN_PROGRESS" },
      currentWarehouse: { id: 2, name: "Main", location: "A1" },
      latestQc: { id: 11, result: "PASS", defectCount: 0, inspectedAt: "2026-01-02T10:00:00.000Z", notes: null },
      latestMovement: { id: 22, fromWarehouseId: null, toWarehouseId: 2, movedAt: "2026-01-03T10:00:00.000Z", reason: "Initial stock" },
      latestDyeingOrder: null,
      latestSalesOrder: null,
    },
    [
      {
        occurredAt: "2026-01-01T00:00:00.000Z",
        type: "roll_created",
        title: "Fabric roll created",
        description: "Roll was generated.",
        status: "IN_STOCK",
        entityType: "fabric_roll",
        entityId: 15,
      },
    ],
  );

  assert.equal(response.workflow.currentStatus, "IN_STOCK");
  assert.equal(response.workflow.nextStep.route, "/sales");
  assert.equal(response.traceability.currentWarehouse?.name, "Main");
  assert.equal(response.traceability.productionOrder?.orderNumber, "PO-5");
  assert.equal(response.timeline[0]?.type, "roll_created");
});

test("fabric roll timeline events are sorted chronologically", () => {
  const events = sortFabricRollTimeline([
    {
      occurredAt: "2026-01-03T00:00:00.000Z",
      type: "warehouse_movement",
      title: "Warehouse movement recorded",
      description: null,
      status: null,
      entityType: "warehouse_movement",
      entityId: 3,
    },
    {
      occurredAt: "2026-01-01T00:00:00.000Z",
      type: "roll_created",
      title: "Fabric roll created",
      description: null,
      status: "IN_PRODUCTION",
      entityType: "fabric_roll",
      entityId: 1,
    },
  ]);

  assert.deepEqual(events.map((event) => event.type), ["roll_created", "warehouse_movement"]);
});
