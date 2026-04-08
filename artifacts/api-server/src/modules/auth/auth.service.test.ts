import test from "node:test";
import assert from "node:assert/strict";
import { createAuthService } from "./auth.service";

function createAuthDeps() {
  const calls = {
    createTenant: 0,
    createUser: 0,
    initPaymentMethods: 0,
    ensureSubscription: 0,
    updateUserPassword: 0,
  };

  const deps = {
    calls,
    service: createAuthService({
      authRepository: {
        findUserByEmail: async () => [],
        findUserById: async () => [{
          id: 7,
          tenantId: 2,
          email: "user@example.com",
          passwordHash: "hash",
          fullName: "User Example",
          role: "admin",
          isActive: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }],
        createTenant: async () => {
          calls.createTenant += 1;
          return [{
            id: 2,
            name: "Tenant",
            currentPlan: "basic",
            billingStatus: "trialing",
            trialEndsAt: new Date(),
            subscriptionEndsAt: new Date(),
          }];
        },
        createUser: async () => {
          calls.createUser += 1;
          return [{
            id: 3,
            tenantId: 2,
            email: "owner@example.com",
            fullName: "Owner",
            role: "admin",
            isActive: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          }];
        },
        updateUserLastLogin: async () => undefined,
        findPlatformAdminById: async () => [],
        updatePlatformAdminLastLogin: async () => undefined,
        updatePlatformAdminPassword: async () => undefined,
        upsertSuperAdminPlatformAccount: async () => [],
        updateUserPassword: async () => {
          calls.updateUserPassword += 1;
          return undefined;
        },
      },
      verifyPlatformAdminCredentials: async () => null,
      getSuperAdminUser: () => null,
      verifySuperAdminCredentials: async () => false,
      comparePassword: async (password) => password === "Current123",
      hashPassword: async (value) => `hashed:${value}`,
      signToken: () => "signed-token",
      paymentMethodsService: {
        initializeTenantPaymentMethods: async () => {
          calls.initPaymentMethods += 1;
        },
      },
      plansService: {
        ensureTenantSubscription: async () => {
          calls.ensureSubscription += 1;
        },
      },
      checkRateLimit: () => ({ limited: false as const }),
      clearRateLimit: () => undefined,
      isStrongPassword: (value) => value === "Strong123",
      isPlatformAdminRole: () => false,
    }),
  };

  return deps;
}

test("authService.register initializes tenant billing dependencies", async () => {
  const { service, calls } = createAuthDeps();

  const result = await service.register({
    companyName: "New Co",
    email: "owner@example.com",
    password: "Strong123",
    fullName: "Owner",
  });

  assert.ok("data" in result);
  if (!("data" in result)) {
    assert.fail("Expected register result to contain data");
  }
  const payload = result.data as { token: string };
  assert.equal(calls.createTenant, 1);
  assert.equal(calls.createUser, 1);
  assert.equal(calls.initPaymentMethods, 1);
  assert.equal(calls.ensureSubscription, 1);
  assert.equal(typeof payload.token, "string");
  assert.ok(payload.token.length > 20);
});

test("authService.changePassword rejects weak passwords before persistence", async () => {
  const { service, calls } = createAuthDeps();

  const result = await service.changePassword(
    { userId: 7, tenantId: 2, role: "admin", email: "user@example.com" },
    { ip: "127.0.0.1" },
    { currentPassword: "Current123", newPassword: "weak" },
  );

  assert.deepEqual(result, {
    status: 400,
    error: "Password must be at least 8 characters and include upper, lower, and number",
  });
  assert.equal(calls.updateUserPassword, 0);
});
