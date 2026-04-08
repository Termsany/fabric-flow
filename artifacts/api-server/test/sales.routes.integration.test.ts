import test from "node:test";
import assert from "node:assert/strict";
import { createSalesController } from "../src/modules/sales/sales.controller";
import { createMockRequest, createMockResponse } from "./helpers/http-mocks";

test("sales controller validates create order body like the API route", async () => {
  const controller = createSalesController({
    salesService: {
      listCustomers: async () => [],
      createCustomer: async () => null as never,
      getCustomer: async () => null,
      updateCustomer: async () => null,
      listSalesOrders: async () => [],
      createSalesOrder: async () => ({ error: "not-used" as const }),
      getSalesOrder: async () => null,
      updateSalesOrder: async () => ({ error: "not-used" as const }),
    },
  });
  const req = createMockRequest({
    user: { userId: 11, tenantId: 4, role: "admin", email: "admin@example.com" },
    body: { customerId: "bad-id" },
  });
  const res = createMockResponse();

  await controller.createSalesOrder(req, res.response);
  assert.equal(res.statusCode, 400);
});

test("sales controller creates order and preserves response shape", async () => {
  const controller = createSalesController({
    salesService: {
      listCustomers: async () => [],
      createCustomer: async () => null as never,
      getCustomer: async () => null,
      updateCustomer: async () => null,
      listSalesOrders: async () => [],
      createSalesOrder: async () => ({
        data: {
          id: 50,
          tenantId: 4,
          orderNumber: "SO-50",
          customerId: 9,
          status: "DRAFT",
          totalAmount: 650,
          rollIds: [1001],
          invoiceNumber: null,
          notes: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
      getSalesOrder: async () => null,
      updateSalesOrder: async () => ({ error: "not-used" as const }),
    },
  });
  const req = createMockRequest({
    user: { userId: 11, tenantId: 4, role: "admin", email: "admin@example.com" },
    body: { customerId: 9, rollIds: [1001], totalAmount: 650 },
  });
  const res = createMockResponse();

  await controller.createSalesOrder(req, res.response);

  assert.equal(res.statusCode, 201);
  const body = res.jsonBody as { orderNumber: string; customerId: number };
  assert.equal(body.orderNumber, "SO-50");
  assert.equal(body.customerId, 9);
});
