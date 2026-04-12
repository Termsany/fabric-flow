import test from "node:test";
import assert from "node:assert/strict";
import {
  assertRollCanReceiveQc,
  buildQcDecision,
  QcWorkflowError,
} from "../src/routes/qc-reports.workflow";

function createRoll(status: string) {
  return { status } as never;
}

test("QC pass makes the roll downstream-eligible", () => {
  const decision = buildQcDecision("passed");

  assert.equal(decision.result, "PASS");
  assert.equal(decision.rollStatus, "QC_PASSED");
  assert.equal(decision.downstreamEligible, true);
  assert.equal(decision.nextStep.route, "/dyeing");
});

test("QC fail blocks downstream workflow", () => {
  const decision = buildQcDecision("failed");

  assert.equal(decision.result, "FAIL");
  assert.equal(decision.rollStatus, "QC_FAILED");
  assert.equal(decision.downstreamEligible, false);
  assert.equal(decision.nextStep.route, "/quality-control");
});

test("QC pending keeps the roll in QC and blocks downstream workflow", () => {
  const decision = buildQcDecision("pending");

  assert.equal(decision.result, "PENDING");
  assert.equal(decision.rollStatus, "QC_PENDING");
  assert.equal(decision.downstreamEligible, false);
  assert.equal(decision.nextStep.route, "/quality-control");
});

test("QC rework keeps the roll in QC and blocks downstream workflow", () => {
  const decision = buildQcDecision("rework");

  assert.equal(decision.result, "REWORK");
  assert.equal(decision.rollStatus, "QC_PENDING");
  assert.equal(decision.downstreamEligible, false);
  assert.equal(decision.nextStep.route, "/quality-control");
});

test("legacy QC second result is treated as rework", () => {
  const decision = buildQcDecision("SECOND");

  assert.equal(decision.result, "REWORK");
  assert.equal(decision.rollStatus, "QC_PENDING");
  assert.equal(decision.downstreamEligible, false);
});

test("QC decisions can only be recorded for rolls in QC", () => {
  assert.doesNotThrow(() => assertRollCanReceiveQc(createRoll("QC_PENDING")));
  assert.doesNotThrow(() => assertRollCanReceiveQc(createRoll("QC_FAILED")));
  assert.throws(() => assertRollCanReceiveQc(createRoll("IN_STOCK")), QcWorkflowError);
});
