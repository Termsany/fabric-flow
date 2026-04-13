import test from "node:test";
import assert from "node:assert/strict";
import { createSalesService } from "../src/modules/sales/sales.service";

function createServiceWithRoll(options: { status: string; warehouseId?: number | null }) {
  const rollStatusUpdates: Array<{ tenantId: number; rollIds: number[]; status: string | undefined }> = [];
  const auditLogs: unknown[] = [];

  const service = createSalesService({
    salesRepository: {
      listCustomers: async () => [],
      createCustomer: async () => [],
      findCustomerById: async () => [{
        id: 9,
        tenantId: 4,
        name: "Customer",
        email: null,
        phone: null,
        address: null,
        taxNumber: null,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }],
      updateCustomer: async () => [],
      listSalesOrders: async () => [],
      findTenantRollIds: async () => [{ id: 1001, status: options.status, warehouseId: options.warehouseId ?? null }],
      createSalesOrder: async () => [{
        id: 50,
        tenantId: 4,
        orderNumber: "SO-50",
        customerId: 9,
        status: "DRAFT",
        totalAmount: 650,
        rollIds: [1001],
        invoiceNumber: null,
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }],
      updateRollStatusForTenant: async (tenantId, rollIds, status) => {
        rollStatusUpdates.push({ tenantId, rollIds, status });
      },
      createWarehouseMovements: async () => [],
      insertAuditLog: async (values) => {
        auditLogs.push(values);
      },
      findSalesOrderById: async () => [],
      updateSalesOrder: async () => [],
      getSalesReportTotals: async () => [],
      listSalesStatusCounts: async () => [],
      listRecentSales: async () => [],
    },
  });

  return { service, rollStatusUpdates, auditLogs };
}

test("sales service rejects fabric rolls that are not in stock", async () => {
  const { service } = createServiceWithRoll({ status: "QC_FAILED", warehouseId: 3 });

  const result = await service.createSalesOrder(4, 11, {
    customerId: 9,
    rollIds: [1001],
    totalAmount: 650,
  });

  assert.deepEqual(result, {
    error: "Only in-stock fabric rolls can be allocated to sales",
    status: 400,
  });
});

test("sales service rejects in-stock rolls without available warehouse stock", async () => {
  const { service } = createServiceWithRoll({ status: "IN_STOCK", warehouseId: null });

  const result = await service.createSalesOrder(4, 11, {
    customerId: 9,
    rollIds: [1001],
    totalAmount: 650,
  });

  assert.deepEqual(result, {
    error: "Selected roll does not have available warehouse stock",
    status: 400,
  });
});

test("sales service reserves valid in-stock rolls and exposes stock source traceability", async () => {
  const { service, rollStatusUpdates, auditLogs } = createServiceWithRoll({ status: "IN_STOCK", warehouseId: 3 });

  const result = await service.createSalesOrder(4, 11, {
    customerId: 9,
    rollIds: [1001],
    totalAmount: 650,
  });

  assert.ok("data" in result);
  assert.equal(result.data.status, "DRAFT");
  assert.deepEqual(result.data.stockSources, [{ fabricRollId: 1001, warehouseId: 3 }]);
  assert.deepEqual(rollStatusUpdates, [{ tenantId: 4, rollIds: [1001], status: "RESERVED" }]);

  const [auditLog] = auditLogs as Array<{ changes: string }>;
  assert.deepEqual(JSON.parse(auditLog.changes).context.stockSources, [{ fabricRollId: 1001, warehouseId: 3 }]);
});

test("sales service audits successful delivery finalization", async () => {
  const auditLogs: unknown[] = [];
  const service = createSalesService({
    salesRepository: {
      listCustomers: async () => [],
      createCustomer: async () => [],
      findCustomerById: async () => [],
      updateCustomer: async () => [],
      listSalesOrders: async () => [],
      findTenantRollIds: async () => [{ id: 1001, status: "RESERVED", warehouseId: 3 }],
      createSalesOrder: async () => [],
      updateRollStatusForTenant: async () => undefined,
      createWarehouseMovements: async () => [],
      insertAuditLog: async (values) => {
        auditLogs.push(values);
      },
      findSalesOrderById: async () => [{
        id: 50,
        tenantId: 4,
        orderNumber: "SO-50",
        customerId: 9,
        status: "DRAFT",
        totalAmount: 650,
        rollIds: [1001],
        invoiceNumber: null,
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }],
      updateSalesOrder: async () => [{
        id: 50,
        tenantId: 4,
        orderNumber: "SO-50",
        customerId: 9,
        status: "DELIVERED",
        totalAmount: 650,
        rollIds: [1001],
        invoiceNumber: "INV-50",
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      }],
      getSalesReportTotals: async () => [],
      listSalesStatusCounts: async () => [],
      listRecentSales: async () => [],
    },
  });

  const result = await service.updateSalesOrder(4, 50, { status: "DELIVERED", invoiceNumber: "INV-50" }, 11);

  assert.ok("data" in result);
  const [auditLog] = auditLogs as Array<{ action: string; userId: number; changes: string }>;
  const changes = JSON.parse(auditLog.changes);
  assert.equal(auditLog.action, "SALES_FINALIZED");
  assert.equal(auditLog.userId, 11);
  assert.deepEqual(changes.before.status, "DRAFT");
  assert.deepEqual(changes.after.status, "DELIVERED");
  assert.deepEqual(changes.context.stockSources, [{ fabricRollId: 1001, warehouseId: 3 }]);
});

test("sales service rejects delivery when reserved stock is missing", async () => {
  const service = createSalesService({
    salesRepository: {
      listCustomers: async () => [],
      createCustomer: async () => [],
      findCustomerById: async () => [],
      updateCustomer: async () => [],
      listSalesOrders: async () => [],
      findTenantRollIds: async () => [{ id: 1001, status: "IN_STOCK", warehouseId: 3 }],
      createSalesOrder: async () => [],
      updateRollStatusForTenant: async () => undefined,
      createWarehouseMovements: async () => [],
      insertAuditLog: async () => undefined,
      findSalesOrderById: async () => [{
        id: 50,
        tenantId: 4,
        orderNumber: "SO-50",
        customerId: 9,
        status: "DRAFT",
        totalAmount: 650,
        rollIds: [1001],
        invoiceNumber: null,
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }],
      updateSalesOrder: async () => [],
      getSalesReportTotals: async () => [],
      listSalesStatusCounts: async () => [],
      listRecentSales: async () => [],
    },
  });

  const result = await service.updateSalesOrder(4, 50, { status: "DELIVERED" });

  assert.deepEqual(result, {
    error: "Only reserved fabric rolls can be marked as sold",
    status: 400,
  });
});
