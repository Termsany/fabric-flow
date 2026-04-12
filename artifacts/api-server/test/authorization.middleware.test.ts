import test from "node:test";
import assert from "node:assert/strict";
import type { NextFunction } from "express";
import { hasAdminPermission, requireAdminPermission, requireTenantAdmin, requireTenantRole } from "../src/lib/auth";
import { createMockRequest, createMockResponse } from "./helpers/http-mocks";

test("requireTenantAdmin denies tenant users", () => {
  const req = createMockRequest({
    user: { userId: 7, tenantId: 2, role: "production", email: "user@example.com" },
  });
  const res = createMockResponse();
  let nextCalled = false;

  requireTenantAdmin(req, res.response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.jsonBody, { error: "Tenant admin access required" });
});

test("requireTenantAdmin allows tenant admins", () => {
  const req = createMockRequest({
    user: { userId: 7, tenantId: 2, role: "tenant_admin", email: "admin@example.com" },
  });
  const res = createMockResponse();
  let nextCalled = false;

  requireTenantAdmin(req, res.response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("requireTenantAdmin allows legacy admin role", () => {
  const req = createMockRequest({
    user: { userId: 7, tenantId: 2, role: "admin", email: "admin@example.com" },
  });
  const res = createMockResponse();
  let nextCalled = false;

  requireTenantAdmin(req, res.response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("requireTenantRole allows specific tenant roles and tenant admins", () => {
  const prodReq = createMockRequest({
    user: { userId: 9, tenantId: 2, role: "production_user", email: "prod@example.com" },
  });
  const adminReq = createMockRequest({
    user: { userId: 7, tenantId: 2, role: "tenant_admin", email: "admin@example.com" },
  });
  const res = createMockResponse();
  let nextCalled = 0;

  requireTenantRole(["production_user"])(prodReq, res.response, (() => {
    nextCalled += 1;
  }) as NextFunction);
  requireTenantRole(["production_user"])(adminReq, res.response, (() => {
    nextCalled += 1;
  }) as NextFunction);

  assert.equal(nextCalled, 2);
});

test("requireTenantRole allows legacy tenant roles", () => {
  const req = createMockRequest({
    user: { userId: 9, tenantId: 2, role: "production", email: "prod@example.com" },
  });
  const res = createMockResponse();
  let nextCalled = false;

  requireTenantRole(["production_user"])(req, res.response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("requireTenantRole denies mismatched tenant roles", () => {
  const req = createMockRequest({
    user: { userId: 9, tenantId: 2, role: "qc_user", email: "qc@example.com" },
  });
  const res = createMockResponse();
  let nextCalled = false;

  requireTenantRole(["production_user"])(req, res.response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.jsonBody, { error: "Tenant role access required" });
});

test("requireAdminPermission denies tenant admins for platform-only permissions", () => {
  const req = createMockRequest({
    user: { userId: 7, tenantId: 2, role: "admin", email: "admin@example.com" },
  });
  const res = createMockResponse();
  let nextCalled = false;

  requireAdminPermission("billing.read")(req, res.response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.jsonBody, { error: "Admin permission required" });
});

test("requireAdminPermission allows matching platform admin roles", () => {
  const req = createMockRequest({
    user: { userId: 1, tenantId: 0, role: "billing_admin", email: "billing@example.com" },
  });
  const res = createMockResponse();
  let nextCalled = false;

  requireAdminPermission("billing.read")(req, res.response, (() => {
    nextCalled = true;
  }) as NextFunction);

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("platform admin permissions keep read-only and write roles separate", () => {
  assert.equal(hasAdminPermission("readonly_admin", "billing.read"), true);
  assert.equal(hasAdminPermission("readonly_admin", "billing.write"), false);
  assert.equal(hasAdminPermission("billing_admin", "payment_methods.manage_global"), false);
  assert.equal(hasAdminPermission("super_admin", "payment_methods.manage_global"), true);
  assert.equal(hasAdminPermission("support_admin", "tenants.impersonate"), true);
});
