import test from "node:test";
import assert from "node:assert/strict";
import { GetInventoryReportResponse } from "@workspace/api-zod";
import { buildInventoryReport } from "../src/modules/warehouses/warehouses.reporting";

test("inventory report summarizes stock and workflow readiness", () => {
  const report = buildInventoryReport({
    lowStockThreshold: 2,
    statusCounts: [
      { status: "IN_PRODUCTION", count: 3 },
      { status: "QC_PENDING", count: 2 },
      { status: "QC_PASSED", count: 4 },
      { status: "FINISHED", count: 1 },
      { status: "IN_STOCK", count: 6 },
      { status: "RESERVED", count: 2 },
      { status: "QC_FAILED", count: 1 },
      { status: "SOLD", count: 5 },
    ],
    warehouseStock: [
      { warehouseId: 10, name: "Main", location: "A1", capacity: 50, currentStock: 8 },
      { warehouseId: 20, name: "Overflow", location: "B1", capacity: null, currentStock: 1 },
    ],
  });

  assert.equal(report.totalRolls, 24);
  assert.equal(report.activeRolls, 19);
  assert.equal(report.currentStock, 8);
  assert.equal(report.availableForSale, 6);
  assert.equal(report.readiness.readyForWarehouse, 5);
  assert.equal(report.readiness.blocked, 1);
  assert.deepEqual(report.lowStockCandidates.map((warehouse) => warehouse.warehouseId), [20]);
  assert.equal(GetInventoryReportResponse.parse(report).byWarehouse.length, 2);
});

test("inventory report handles empty tenants without special cases", () => {
  const report = buildInventoryReport({
    lowStockThreshold: 5,
    statusCounts: [],
    warehouseStock: [],
  });

  assert.deepEqual(report, {
    totalRolls: 0,
    activeRolls: 0,
    currentStock: 0,
    availableForSale: 0,
    reserved: 0,
    sold: 0,
    byStatus: [],
    readiness: {
      inProduction: 0,
      awaitingQc: 0,
      readyForDyeing: 0,
      readyForWarehouse: 0,
      availableForSale: 0,
      blocked: 0,
    },
    lowStockCandidates: [],
    byWarehouse: [],
  });
});
