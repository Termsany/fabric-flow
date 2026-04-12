import test from "node:test";
import assert from "node:assert/strict";
import { GetSalesReportResponse } from "@workspace/api-zod";
import { buildSalesReport } from "../src/modules/sales/sales.reporting";

test("buildSalesReport summarizes totals and recent sales", () => {
  const report = buildSalesReport({
    totals: {
      totalSalesCount: 4,
      deliveredSalesCount: 2,
      pendingSalesCount: 1,
      recordedTotalAmount: 1500,
      totalRollsAllocated: 10,
      deliveredRolls: 6,
    },
    statusCounts: [
      { status: "DRAFT", count: 1 },
      { status: "CONFIRMED", count: 1 },
      { status: "DELIVERED", count: 2 },
    ],
    recentSales: [{
      id: 9,
      tenantId: 4,
      orderNumber: "SO-9",
      customerId: 3,
      status: "DELIVERED",
      totalAmount: 500,
      rollIds: [11, 12],
      invoiceNumber: "INV-9",
      notes: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    }],
  });

  assert.equal(report.totalSalesCount, 4);
  assert.equal(report.recordedTotalAmount, 1500);
  assert.equal(report.volume.totalRollsAllocated, 10);
  assert.equal(report.volume.deliveredRolls, 6);
  assert.equal(report.volume.averageRollsPerSale, 2.5);
  assert.equal(report.recentSales[0]?.rollCount, 2);
  assert.equal(report.recentSales[0]?.invoiceNumber, "INV-9");
  assert.equal(GetSalesReportResponse.parse(report).recentSales.length, 1);
});

test("buildSalesReport handles empty sales data", () => {
  const report = buildSalesReport({
    totals: {
      totalSalesCount: 0,
      deliveredSalesCount: 0,
      pendingSalesCount: 0,
      recordedTotalAmount: 0,
      totalRollsAllocated: 0,
      deliveredRolls: 0,
    },
    statusCounts: [],
    recentSales: [],
  });

  assert.deepEqual(report, {
    totalSalesCount: 0,
    deliveredSalesCount: 0,
    pendingSalesCount: 0,
    recordedTotalAmount: 0,
    volume: {
      totalRollsAllocated: 0,
      deliveredRolls: 0,
      averageRollsPerSale: 0,
    },
    byStatus: [],
    recentSales: [],
  });
});
