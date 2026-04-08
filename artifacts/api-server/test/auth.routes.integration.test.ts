import test from "node:test";
import assert from "node:assert/strict";
import { createAuthController } from "../src/modules/auth/auth.controller";
import { createMockRequest, createMockResponse } from "./helpers/http-mocks";

test("auth controller validates login payloads like the API route", async () => {
  const controller = createAuthController({
    authService: {
      login: async () => null,
      register: async () => ({ error: "not-used" as const }),
      getCurrentUser: async () => ({ error: "not-used" as const }),
      changePassword: async () => ({ status: 200 as const, data: { success: true } }),
    },
  });
  const req = createMockRequest({ body: { email: "bad" } });
  const res = createMockResponse();

  await controller.login(req, res.response);

  assert.equal(res.statusCode, 400);
  assert.match(String((res.jsonBody as { error?: string }).error), /password/i);
});

test("auth controller returns login result from service", async () => {
  const controller = createAuthController({
    authService: {
      login: async () => ({
        token: "token-1",
        user: {
          id: 1,
          tenantId: 2,
          email: "admin@example.com",
          fullName: "Admin",
          role: "admin",
          isActive: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
      register: async () => ({ error: "not-used" as const }),
      getCurrentUser: async () => ({ error: "not-used" as const }),
      changePassword: async () => ({ status: 200 as const, data: { success: true } }),
    },
  });
  const req = createMockRequest({
    body: { email: "admin@example.com", password: "Strong123" },
  });
  const res = createMockResponse();

  await controller.login(req, res.response);

  assert.equal(res.statusCode, 200);
  const body = res.jsonBody as { token: string; user: { email: string } };
  assert.equal(body.token, "token-1");
  assert.equal(body.user.email, "admin@example.com");
});
