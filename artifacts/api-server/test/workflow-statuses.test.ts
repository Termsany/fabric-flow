import test from "node:test";
import assert from "node:assert/strict";
import {
  FABRIC_ROLL_WORKFLOW_STATUS,
  SALES_WORKFLOW_STATUS,
  WORKFLOW_DEFAULTS,
  getFabricRollStatusFromQcResult,
  isFabricRollTransitionAllowed,
} from "@workspace/api-zod";

test("workflow defaults stay aligned with shared core statuses", () => {
  assert.equal(WORKFLOW_DEFAULTS.fabricRollStatus, "CREATED");
  assert.equal(WORKFLOW_DEFAULTS.productionOrderStatus, "PENDING");
  assert.equal(WORKFLOW_DEFAULTS.dyeingOrderStatus, "PENDING");
  assert.equal(WORKFLOW_DEFAULTS.salesOrderStatus, SALES_WORKFLOW_STATUS.draft);
  assert.equal(WORKFLOW_DEFAULTS.qcResult, "PASS");
});

test("QC result mapping returns the expected fabric roll workflow status", () => {
  assert.equal(getFabricRollStatusFromQcResult("PASS"), FABRIC_ROLL_WORKFLOW_STATUS.qcPassed);
  assert.equal(getFabricRollStatusFromQcResult("FAIL"), FABRIC_ROLL_WORKFLOW_STATUS.qcFailed);
  assert.equal(getFabricRollStatusFromQcResult("SECOND"), FABRIC_ROLL_WORKFLOW_STATUS.qcPending);
});

test("fabric roll transitions allow QC outcomes to be revised safely", () => {
  assert.ok(isFabricRollTransitionAllowed("QC_PASSED", "QC_FAILED"));
  assert.ok(isFabricRollTransitionAllowed("QC_FAILED", "QC_PASSED"));
  assert.ok(isFabricRollTransitionAllowed("QC_PASSED", "QC_PENDING"));
});

test("fabric roll transitions block invalid jumps", () => {
  assert.equal(isFabricRollTransitionAllowed("CREATED", "SOLD"), false);
});
