import test from "node:test";
import assert from "node:assert/strict";
import { createAuthController } from "../src/modules/auth/auth.controller";
import { createSalesController } from "../src/modules/sales/sales.controller";
import { createMockRequest, createMockResponse } from "./helpers/http-mocks";

test("main auth-to-order flow works through controller layer", async () => {
  const authController = createAuthController({
    authService: {
      login: async () => ({
        ok: true,
        status: 200,
        data: {
          token: "token-1",
          user: {
            id: 11,
            tenantId: 4,
            email: "admin@example.com",
            fullName: "Admin",
            role: "admin",
            isActive: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      }),
      register: async () => ({ ok: false, status: 400, error: "not-used" }),
      getCurrentUser: async () => ({
        ok: true,
        status: 200,
        data: {
          id: 11,
          tenantId: 4,
          email: "admin@example.com",
          fullName: "Admin",
          role: "admin",
          isActive: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
      changePassword: async () => ({ ok: true, status: 200, data: { success: true } }),
    },
  });
  const salesController = createSalesController({
    salesService: {
      listCustomers: async () => [],
      createCustomer: async () => ({
        id: 9,
        tenantId: 4,
        name: "Customer One",
        email: null,
        phone: null,
        address: null,
        taxNumber: null,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      getCustomer: async () => null,
      updateCustomer: async () => null,
      listSalesOrders: async () => [],
      getSalesReport: async () => ({
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
      }),
      createSalesOrder: async () => ({
        data: {
          id: 50,
          tenantId: 4,
          orderNumber: "SO-50",
          customerId: 9,
          status: "DRAFT",
          totalAmount: 650,
          rollIds: [1],
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

  const loginReq = createMockRequest({
    body: { email: "admin@example.com", password: "Strong123" },
  });
  const loginRes = createMockResponse();
  await authController.login(loginReq, loginRes.response);
  assert.equal(loginRes.statusCode, 200);

  const meReq = createMockRequest({
    user: { userId: 11, tenantId: 4, role: "admin", email: "admin@example.com" },
  });
  const meRes = createMockResponse();
  await authController.getMe(meReq, meRes.response);
  assert.equal(meRes.statusCode, 200);

  const customerReq = createMockRequest({
    user: { userId: 11, tenantId: 4, role: "admin", email: "admin@example.com" },
    body: { name: "Customer One" },
  });
  const customerRes = createMockResponse();
  await salesController.createCustomer(customerReq, customerRes.response);
  assert.equal(customerRes.statusCode, 201);

  const orderReq = createMockRequest({
    user: { userId: 11, tenantId: 4, role: "admin", email: "admin@example.com" },
    body: { customerId: 9, totalAmount: 650, rollIds: [1] },
  });
  const orderRes = createMockResponse();
  await salesController.createSalesOrder(orderReq, orderRes.response);
  assert.equal(orderRes.statusCode, 201);
  const order = orderRes.jsonBody as { orderNumber: string };
  assert.equal(order.orderNumber, "SO-50");
});
