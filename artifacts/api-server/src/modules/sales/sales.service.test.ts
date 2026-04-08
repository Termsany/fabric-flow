import test from "node:test";
import assert from "node:assert/strict";
import { createSalesService } from "./sales.service";

test("salesService.createSalesOrder rejects tenant roll mismatch", async () => {
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
      findTenantRollIds: async () => [{ id: 10 }],
      createSalesOrder: async () => [],
      updateRollStatusForTenant: async () => undefined,
      insertAuditLog: async () => undefined,
      findSalesOrderById: async () => [],
      updateSalesOrder: async () => [],
    },
  });

  const result = await service.createSalesOrder(4, 22, {
    customerId: 9,
    rollIds: [10, 11],
    totalAmount: 500,
  });

  assert.deepEqual(result, {
    error: "One or more selected rolls do not belong to this tenant",
    status: 400,
  });
});

test("salesService.updateSalesOrder marks delivered rolls as sold", async () => {
  const calls: Array<{ tenantId: number; rollIds: number[]; status: string }> = [];
  const service = createSalesService({
    salesRepository: {
      listCustomers: async () => [],
      createCustomer: async () => [],
      findCustomerById: async () => [],
      updateCustomer: async () => [],
      listSalesOrders: async () => [],
      findTenantRollIds: async () => [],
      createSalesOrder: async () => [],
      updateRollStatusForTenant: async (tenantId, rollIds, status) => {
        calls.push({ tenantId, rollIds, status: status ?? "" });
      },
      insertAuditLog: async () => undefined,
      findSalesOrderById: async () => [{
        id: 77,
        tenantId: 4,
        orderNumber: "SO-1",
        customerId: 9,
        status: "DRAFT",
        totalAmount: 500,
        rollIds: [101, 102],
        invoiceNumber: null,
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }],
      updateSalesOrder: async () => [{
        id: 77,
        tenantId: 4,
        orderNumber: "SO-1",
        customerId: 9,
        status: "DELIVERED",
        totalAmount: 500,
        rollIds: [101, 102],
        invoiceNumber: null,
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      }],
    },
  });

  const result = await service.updateSalesOrder(4, 77, { status: "DELIVERED" });

  assert.ok("data" in result);
  assert.deepEqual(calls, [{ tenantId: 4, rollIds: [101, 102], status: "SOLD" }]);
});
