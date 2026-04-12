import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCreateProductionOrderBody,
  parseCreateQcReportBody,
  parseUpdateFabricRollBody,
} from "../src/routes/operational-workflow.validation";

test("production order validation rejects blank required fields", () => {
  const result = parseCreateProductionOrderBody({
    fabricType: "   ",
    gsm: 180,
    width: 160,
    rawColor: "White",
    quantity: 4,
  });

  assert.equal(result.success, false);
  if (result.success) {
    assert.fail("Expected create production order payload to fail");
  }

  assert.match(result.error.issues[0]?.message ?? "", /fabricType is required/i);
});

test("fabric roll update validation rejects unsupported statuses", () => {
  const result = parseUpdateFabricRollBody({
    status: "archived",
  });

  assert.equal(result.success, false);
  if (result.success) {
    assert.fail("Expected fabric roll update payload to fail");
  }

  assert.match(result.error.issues[0]?.message ?? "", /status must be one of/i);
});

test("qc validation normalizes predictable result input", () => {
  const result = parseCreateQcReportBody({
    fabricRollId: 10,
    result: " pass ",
    defectCount: 0,
    images: ["  image-1.png  "],
  });

  assert.equal(result.success, true);
  if (!result.success) {
    assert.fail("Expected QC payload to pass after normalization");
  }

  assert.equal(result.data.result, "PASS");
  assert.deepEqual(result.data.images, ["image-1.png"]);
});

test("qc validation accepts canonical pending and rework decisions", () => {
  const pending = parseCreateQcReportBody({
    fabricRollId: 10,
    result: "pending",
    defectCount: 0,
  });
  const rework = parseCreateQcReportBody({
    fabricRollId: 10,
    result: "rework",
    defectCount: 1,
  });

  assert.equal(pending.success, true);
  assert.equal(rework.success, true);
  if (!pending.success || !rework.success) {
    assert.fail("Expected pending and rework QC payloads to pass");
  }

  assert.equal(pending.data.result, "PENDING");
  assert.equal(rework.data.result, "REWORK");
});

test("qc validation maps legacy second result to rework", () => {
  const result = parseCreateQcReportBody({
    fabricRollId: 10,
    result: "second",
    defectCount: 1,
  });

  assert.equal(result.success, true);
  if (!result.success) {
    assert.fail("Expected legacy second QC payload to pass");
  }

  assert.equal(result.data.result, "REWORK");
});

test("qc validation rejects invalid results", () => {
  const result = parseCreateQcReportBody({
    fabricRollId: 10,
    result: "retry",
    defectCount: 0,
  });

  assert.equal(result.success, false);
  if (result.success) {
    assert.fail("Expected QC payload to fail");
  }

  assert.match(result.error.issues[0]?.message ?? "", /result must be one of/i);
});
