import test from "node:test";
import assert from "node:assert/strict";
import { requireOperationalAccess } from "./tenant-rbac";

function createResponse() {
  let statusCode: number | null = null;
  let payload: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(body: unknown) {
      payload = body;
      return res;
    },
  };
  return { res, getStatus: () => statusCode, getPayload: () => payload };
}

async function runMiddleware(middleware: (req: any, res: any, next: () => void) => void, req: any) {
  const { res, getStatus, getPayload } = createResponse();
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };
  await middleware(req, res, next);
  return { nextCalled, status: getStatus(), payload: getPayload() };
}

test("requireOperationalAccess allows read for production_user", async () => {
  const middleware = requireOperationalAccess("production", "read");
  const result = await runMiddleware(middleware, { user: { role: "production_user" } });
  assert.equal(result.nextCalled, true);
});

test("requireOperationalAccess denies read for non-matching role", async () => {
  const middleware = requireOperationalAccess("production", "read");
  const result = await runMiddleware(middleware, { user: { role: "qc_user" } });
  assert.equal(result.nextCalled, false);
  assert.equal(result.status, 403);
  assert.deepEqual(result.payload, { error: "Tenant role access required" });
});

test("requireOperationalAccess allows tenant_admin by default", async () => {
  const middleware = requireOperationalAccess("sales", "write");
  const result = await runMiddleware(middleware, { user: { role: "tenant_admin" } });
  assert.equal(result.nextCalled, true);
});

test("requireOperationalAccess denies unauthenticated requests", async () => {
  const middleware = requireOperationalAccess("warehouse", "read");
  const result = await runMiddleware(middleware, { user: null });
  assert.equal(result.nextCalled, false);
  assert.equal(result.status, 401);
  assert.deepEqual(result.payload, { error: "Unauthorized" });
});
