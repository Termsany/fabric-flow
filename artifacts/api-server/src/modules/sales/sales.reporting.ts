import type { salesOrdersTable } from "@workspace/db";

type SalesOrderRow = typeof salesOrdersTable.$inferSelect;

export type SalesReportTotals = {
  totalSalesCount: number;
  deliveredSalesCount: number;
  pendingSalesCount: number;
  recordedTotalAmount: number;
  totalRollsAllocated: number;
  deliveredRolls: number;
};

export type SalesStatusCount = {
  status: string;
  count: number;
};

export function formatRecentSale(order: SalesOrderRow) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    status: order.status,
    totalAmount: order.totalAmount,
    rollCount: order.rollIds?.length ?? 0,
    invoiceNumber: order.invoiceNumber ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function buildSalesReport(input: {
  totals: SalesReportTotals;
  statusCounts: SalesStatusCount[];
  recentSales: SalesOrderRow[];
}) {
  return {
    totalSalesCount: input.totals.totalSalesCount,
    deliveredSalesCount: input.totals.deliveredSalesCount,
    pendingSalesCount: input.totals.pendingSalesCount,
    recordedTotalAmount: input.totals.recordedTotalAmount,
    volume: {
      totalRollsAllocated: input.totals.totalRollsAllocated,
      deliveredRolls: input.totals.deliveredRolls,
      averageRollsPerSale: input.totals.totalSalesCount === 0
        ? 0
        : Number((input.totals.totalRollsAllocated / input.totals.totalSalesCount).toFixed(2)),
    },
    byStatus: input.statusCounts,
    recentSales: input.recentSales.map(formatRecentSale),
  };
}
