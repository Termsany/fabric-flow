import test from "node:test";
import assert from "node:assert/strict";
import { createAuthService } from "./auth.service";
import type { PlatformAdminRole } from "../../lib/auth";

type TestUserRow = {
  id: number;
  tenantId: number;
  email: string;
  passwordHash: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type TestPlatformAdminRow = {
  id: number;
  email: string;
  passwordHash: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TestSuperAdminUser = {
  id: number;
  tenantId: number;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
};

function createAppUser(overrides: Partial<TestUserRow> = {}): TestUserRow {
  return {
    id: 7,
    tenantId: 2,
    email: "user@example.com",
    passwordHash: "hash:user",
    fullName: "User Example",
    role: "admin",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createPlatformAdmin(overrides: Partial<TestPlatformAdminRow> = {}): TestPlatformAdminRow {
  return {
    id: 11,
    email: "platform@example.com",
    passwordHash: "hash:platform",
    fullName: "Platform Admin",
    role: "platform_admin",
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createAuthDeps(options?: {
  usersByEmail?: TestUserRow[];
  usersById?: TestUserRow[];
  platformAdminsById?: TestPlatformAdminRow[];
  platformAdminCredentialsResult?: TestPlatformAdminRow | null;
  superAdminUser?: TestSuperAdminUser | null;
  superAdminCredentialsValid?: boolean;
  upsertedSuperAdminAccount?: TestPlatformAdminRow[];
  rateLimitLimited?: boolean;
  isPlatformAdminRole?: (role: string) => role is PlatformAdminRole;
  useTransactionalCreation?: boolean;
  transactionalCreationError?: Error | null;
  provisioningErrorAt?: "paymentMethods" | "subscription" | null;
}) {
  const calls = {
    createTenant: 0,
    createUser: 0,
    createTenantWithAdmin: 0,
    initPaymentMethods: 0,
    ensureSubscription: 0,
    updateUserPassword: 0,
    updateUserLastLogin: 0,
    updatePlatformAdminLastLogin: 0,
    updatePlatformAdminPassword: 0,
    upsertSuperAdminPlatformAccount: 0,
  };

  const usersByEmail = options?.usersByEmail ?? [];
  const usersById = options?.usersById ?? [createAppUser()];
  const platformAdminsById = options?.platformAdminsById ?? [];
  const platformAdminCredentialsResult = options?.platformAdminCredentialsResult ?? null;
  const superAdminUser = options?.superAdminUser ?? null;
  const superAdminCredentialsValid = options?.superAdminCredentialsValid ?? false;
  const upsertedSuperAdminAccount = options?.upsertedSuperAdminAccount ?? [];
  const useTransactionalCreation = options?.useTransactionalCreation ?? true;
  const transactionalCreationError = options?.transactionalCreationError ?? null;
  const provisioningErrorAt = options?.provisioningErrorAt ?? null;

  const deps = {
    calls,
    service: createAuthService({
      authRepository: {
        findUserByEmail: async () => usersByEmail,
        findUserById: async () => usersById,
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
        createTenantWithAdmin: useTransactionalCreation
          ? async () => {
            calls.createTenantWithAdmin += 1;
            if (transactionalCreationError) {
              throw transactionalCreationError;
            }

            return {
              tenant: {
                id: 2,
                name: "Tenant",
                currentPlan: "basic",
                billingStatus: "trialing",
                trialEndsAt: new Date(),
                subscriptionEndsAt: new Date(),
              },
              user: {
                id: 3,
                tenantId: 2,
                email: "owner@example.com",
                fullName: "Owner",
                role: "admin",
                isActive: true,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              },
            };
          }
          : undefined,
        updateUserLastLogin: async () => {
          calls.updateUserLastLogin += 1;
          return undefined;
        },
        updateUserPassword: async () => {
          calls.updateUserPassword += 1;
          return undefined;
        },
        findPlatformAdminById: async () => platformAdminsById,
        updatePlatformAdminLastLogin: async () => {
          calls.updatePlatformAdminLastLogin += 1;
          return undefined;
        },
        updatePlatformAdminPassword: async () => {
          calls.updatePlatformAdminPassword += 1;
          return undefined;
        },
        upsertSuperAdminPlatformAccount: async () => {
          calls.upsertSuperAdminPlatformAccount += 1;
          return upsertedSuperAdminAccount;
        },
      },
      verifyPlatformAdminCredentials: async () => platformAdminCredentialsResult,
      getSuperAdminUser: () => superAdminUser,
      verifySuperAdminCredentials: async () => superAdminCredentialsValid,
      comparePassword: async (password, hash) => {
        if (hash === "hash:user") {
          return password === "Current123" || password === "Strong123";
        }
        if (hash === "hash:platform") {
          return password === "Current123" || password === "PlatformPass123";
        }
        return password === "Current123";
      },
      hashPassword: async (value) => `hashed:${value}`,
      signToken: () => "signed-token",
      paymentMethodsService: {
        initializeTenantPaymentMethods: async () => {
          if (provisioningErrorAt === "paymentMethods") {
            throw new Error("payment methods failed");
          }
          calls.initPaymentMethods += 1;
        },
      },
      plansService: {
        ensureTenantSubscription: async () => {
          if (provisioningErrorAt === "subscription") {
            throw new Error("subscription failed");
          }
          calls.ensureSubscription += 1;
        },
      },
      checkRateLimit: () => ({ limited: options?.rateLimitLimited ?? false }),
      clearRateLimit: () => undefined,
      isStrongPassword: (value) => value === "Strong123" || value === "PlatformPass123",
      isPlatformAdminRole: options?.isPlatformAdminRole ?? ((_: string): _ is PlatformAdminRole => false),
    }),
  };

  return deps;
}

test("authService.login prefers platform admin over other matching identities", async () => {
  const { service, calls } = createAuthDeps({
    usersByEmail: [createAppUser({ email: "platform@example.com" })],
    platformAdminCredentialsResult: createPlatformAdmin({ email: "platform@example.com" }),
    superAdminUser: {
      id: 0,
      tenantId: 0,
      email: "platform@example.com",
      fullName: "Env Super Admin",
      role: "super_admin",
      isActive: true,
    },
    superAdminCredentialsValid: true,
  });

  const result = await service.login("platform@example.com", "Strong123");

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected successful login");
  }
  assert.equal(result.status, 200);
  assert.equal(result.data.user.role, "platform_admin");
  assert.equal(result.data.user.email, "platform@example.com");
  assert.equal(calls.updatePlatformAdminLastLogin, 1);
  assert.equal(calls.updateUserLastLogin, 0);
});

test("authService.login falls back to app user when admin branches do not match", async () => {
  const { service, calls } = createAuthDeps({
    usersByEmail: [createAppUser({ email: "owner@example.com" })],
  });

  const result = await service.login("owner@example.com", "Strong123");

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected successful login");
  }
  assert.equal(result.data.user.email, "owner@example.com");
  assert.equal(result.data.user.tenantId, 2);
  assert.equal(calls.updateUserLastLogin, 1);
  assert.equal(calls.updatePlatformAdminLastLogin, 0);
});

test("authService.login uses the env super admin path when platform admin auth does not match", async () => {
  const { service, calls } = createAuthDeps({
    superAdminUser: {
      id: 0,
      tenantId: 0,
      email: "superadmin@fabric.local",
      fullName: "Env Super Admin",
      role: "super_admin",
      isActive: true,
    },
    superAdminCredentialsValid: true,
  });

  const result = await service.login("superadmin@fabric.local", "Strong123");

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected successful super admin login");
  }
  assert.equal(result.status, 200);
  assert.equal(result.data.user.role, "super_admin");
  assert.equal(result.data.user.email, "superadmin@fabric.local");
  assert.equal(calls.updatePlatformAdminLastLogin, 0);
  assert.equal(calls.updateUserLastLogin, 0);
});

test("authService.register initializes tenant billing dependencies", async () => {
  const { service, calls } = createAuthDeps();

  const result = await service.register({
    companyName: "New Co",
    email: "owner@example.com",
    password: "Strong123",
    fullName: "Owner",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected register result to contain data");
  }
  assert.equal(result.status, 201);
  assert.equal(calls.createTenantWithAdmin, 1);
  assert.equal(calls.createTenant, 0);
  assert.equal(calls.createUser, 0);
  assert.equal(calls.initPaymentMethods, 1);
  assert.equal(calls.ensureSubscription, 1);
  assert.equal(typeof result.data.token, "string");
  assert.ok(result.data.token.length > 5);
});

test("authService.register surfaces provisioning failure after successful core creation", async () => {
  const { service, calls } = createAuthDeps({
    provisioningErrorAt: "subscription",
  });

  await assert.rejects(
    () => service.register({
      companyName: "New Co",
      email: "owner@example.com",
      password: "Strong123",
      fullName: "Owner",
    }),
    /Registration provisioning failed after core account creation/,
  );

  assert.equal(calls.createTenantWithAdmin, 1);
  assert.equal(calls.initPaymentMethods, 1);
  assert.equal(calls.ensureSubscription, 0);
});

test("authService.register stops before provisioning when transactional core creation fails", async () => {
  const { service, calls } = createAuthDeps({
    transactionalCreationError: new Error("core creation failed"),
  });

  await assert.rejects(
    () => service.register({
      companyName: "New Co",
      email: "owner@example.com",
      password: "Strong123",
      fullName: "Owner",
    }),
    /core creation failed/,
  );

  assert.equal(calls.createTenantWithAdmin, 1);
  assert.equal(calls.createTenant, 0);
  assert.equal(calls.createUser, 0);
  assert.equal(calls.initPaymentMethods, 0);
  assert.equal(calls.ensureSubscription, 0);
});

test("authService.register stops early when email is already registered", async () => {
  const { service, calls } = createAuthDeps({
    usersByEmail: [createAppUser({ email: "owner@example.com" })],
  });

  const result = await service.register({
    companyName: "New Co",
    email: "owner@example.com",
    password: "Strong123",
    fullName: "Owner",
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "Email already registered",
  });
  assert.equal(calls.createTenant, 0);
  assert.equal(calls.createUser, 0);
  assert.equal(calls.initPaymentMethods, 0);
  assert.equal(calls.ensureSubscription, 0);
});

test("authService.changePassword rejects weak passwords before persistence", async () => {
  const { service, calls } = createAuthDeps();

  const result = await service.changePassword(
    { userId: 7, tenantId: 2, role: "admin", email: "user@example.com" },
    { ip: "127.0.0.1" },
    { currentPassword: "Current123", newPassword: "weak" },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "Password must be at least 8 characters and include upper, lower, and number",
  });
  assert.equal(calls.updateUserPassword, 0);
  assert.equal(calls.updatePlatformAdminPassword, 0);
});

test("authService.changePassword updates platform admin passwords through the admin branch", async () => {
  const { service, calls } = createAuthDeps({
    platformAdminsById: [createPlatformAdmin()],
    isPlatformAdminRole: (role): role is PlatformAdminRole => role === "platform_admin",
  });

  const result = await service.changePassword(
    { userId: 11, tenantId: 0, role: "platform_admin", email: "platform@example.com" },
    { ip: "127.0.0.1" },
    { currentPassword: "Current123", newPassword: "PlatformPass123" },
  );

  assert.deepEqual(result, {
    ok: true,
    status: 200,
    data: { success: true },
  });
  assert.equal(calls.updatePlatformAdminPassword, 1);
  assert.equal(calls.updateUserPassword, 0);
});

test("authService.changePassword updates app user passwords through the app-user branch", async () => {
  const { service, calls } = createAuthDeps();

  const result = await service.changePassword(
    { userId: 7, tenantId: 2, role: "admin", email: "user@example.com" },
    { ip: "127.0.0.1" },
    { currentPassword: "Current123", newPassword: "Strong123" },
  );

  assert.deepEqual(result, {
    ok: true,
    status: 200,
    data: { success: true },
  });
  assert.equal(calls.updateUserPassword, 1);
  assert.equal(calls.updatePlatformAdminPassword, 0);
});

test("authService.getCurrentUser rejects app-user tokens whose tenant does not match the loaded user", async () => {
  const { service } = createAuthDeps({
    usersById: [createAppUser({ tenantId: 99 })],
  });

  const result = await service.getCurrentUser({
    userId: 7,
    tenantId: 2,
    role: "admin",
    email: "user@example.com",
  });

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    error: "User not found",
  });
});

test("authService.changePassword rejects app-user tokens whose tenant does not match the loaded user", async () => {
  const { service, calls } = createAuthDeps({
    usersById: [createAppUser({ tenantId: 99 })],
  });

  const result = await service.changePassword(
    { userId: 7, tenantId: 2, role: "admin", email: "user@example.com" },
    { ip: "127.0.0.1" },
    { currentPassword: "Current123", newPassword: "Strong123" },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 404,
    error: "User not found",
  });
  assert.equal(calls.updateUserPassword, 0);
});

test("authService.changePassword migrates env super admin into a platform admin account", async () => {
  const { service, calls } = createAuthDeps({
    superAdminUser: {
      id: 0,
      tenantId: 0,
      email: "superadmin@fabric.local",
      fullName: "Super Admin",
      role: "super_admin",
      isActive: true,
    },
    superAdminCredentialsValid: true,
    upsertedSuperAdminAccount: [createPlatformAdmin({ id: 99, email: "superadmin@fabric.local" })],
    isPlatformAdminRole: (role): role is PlatformAdminRole => role === "platform_admin",
  });

  const result = await service.changePassword(
    { userId: 0, tenantId: 0, role: "super_admin", email: "superadmin@fabric.local" },
    { ip: "127.0.0.1" },
    { currentPassword: "Current123", newPassword: "PlatformPass123" },
  );

  assert.deepEqual(result, {
    ok: true,
    status: 200,
    data: { success: true, migrated: true },
  });
  assert.equal(calls.upsertSuperAdminPlatformAccount, 1);
  assert.equal(calls.updatePlatformAdminPassword, 0);
  assert.equal(calls.updateUserPassword, 0);
});
