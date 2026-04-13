import test from "node:test";
import assert from "node:assert/strict";
import {
  assertDyeingOrderTransitionAllowed,
  assertFabricRollTransitionAllowed,
  assertProductionOrderTransitionAllowed,
  assertSalesOrderTransitionAllowed,
} from "../src/modules/workflow/transition-guards";

test("production order transitions block invalid jumps", () => {
  assert.throws(
    () => assertProductionOrderTransitionAllowed("PENDING", "COMPLETED"),
    /Invalid production order status transition/i,
  );
});

test("sales order transitions enforce the expected sequence", () => {
  assert.doesNotThrow(() => assertSalesOrderTransitionAllowed("DRAFT", "CONFIRMED"));
  assert.throws(
    () => assertSalesOrderTransitionAllowed("DELIVERED", "CONFIRMED"),
    /Invalid sales order status transition/i,
  );
});

test("fabric roll transitions allow QC revisions but block impossible jumps", () => {
  assert.doesNotThrow(() => assertFabricRollTransitionAllowed("QC_FAILED", "QC_PASSED"));
  assert.throws(
    () => assertFabricRollTransitionAllowed("CREATED", "SOLD"),
    /Invalid fabric roll status transition/i,
  );
});

test("dyeing order transitions reject reopening terminal states", () => {
  assert.throws(
    () => assertDyeingOrderTransitionAllowed("COMPLETED", "IN_PROGRESS"),
    /Invalid dyeing order status transition/i,
  );
});
