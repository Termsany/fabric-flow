import test from "node:test";
import assert from "node:assert/strict";
import { GetDashboardStatsResponse } from "@workspace/api-zod";

test("dashboard stats schema accepts v1 operational metrics", () => {
  const parsed = GetDashboardStatsResponse.parse({
    totalRolls: 12,
    inProduction: 2,
    inQcPending: 1,
    qcPassed: 4,
    qcFailed: 1,
    inDyeing: 1,
    inStock: 3,
    reserved: 1,
    sold: 2,
    activeRolls: 10,
    activeProductionOrders: 2,
    activeDyeingOrders: 1,
    pendingSalesOrders: 1,
    totalCustomers: 5,
    qcOutcomes: {
      total: 7,
      passed: 4,
      failed: 1,
      pending: 1,
      rework: 1,
    },
    availableInventory: {
      inStock: 3,
      reserved: 1,
      availableForSale: 3,
      warehouseStock: 4,
    },
    salesSummary: {
      totalOrders: 4,
      pendingOrders: 1,
      deliveredOrders: 2,
      totalRevenue: 1500,
      deliveredRevenue: 900,
    },
  });

  assert.equal(parsed.activeRolls, 10);
  assert.equal(parsed.qcOutcomes.rework, 1);
  assert.equal(parsed.availableInventory.availableForSale, 3);
  assert.equal(parsed.salesSummary.deliveredRevenue, 900);
});
