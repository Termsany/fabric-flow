import test from "node:test";
import assert from "node:assert/strict";
import { buildAuditChanges, pickAuditFields } from "../src/utils/audit-log";

test("buildAuditChanges creates a consistent troubleshooting payload", () => {
  const changes = JSON.parse(buildAuditChanges({
    before: { status: "DRAFT" },
    after: { status: "DELIVERED" },
    context: { orderNumber: "SO-1" },
    reason: "customer pickup complete",
  }));

  assert.deepEqual(changes, {
    before: { status: "DRAFT" },
    after: { status: "DELIVERED" },
    context: { orderNumber: "SO-1" },
    reason: "customer pickup complete",
  });
});

test("pickAuditFields keeps audit logs focused on important fields", () => {
  const picked = pickAuditFields({
    status: "QC_PASSED",
    notes: null,
    noisyField: "not useful here",
  }, ["status", "notes"]);

  assert.deepEqual(picked, {
    status: "QC_PASSED",
    notes: null,
  });
});
