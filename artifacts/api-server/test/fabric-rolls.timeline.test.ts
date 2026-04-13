import test from "node:test";
import assert from "node:assert/strict";
import { buildRollStatusChangeEvent } from "../src/routes/fabric-rolls.workflow";

test("buildRollStatusChangeEvent returns a timeline entry when status info exists", () => {
  const event = buildRollStatusChangeEvent({
    occurredAt: "2026-02-01T10:00:00.000Z",
    entityId: 22,
    beforeStatus: "QC_PENDING",
    afterStatus: "QC_PASSED",
    action: "STATUS_CHANGED",
    context: { source: "qc" },
  });

  assert.ok(event);
  assert.equal(event?.type, "roll_status_change");
  assert.equal(event?.status, "QC_PASSED");
  assert.match(event?.description ?? "", /QC_PENDING/);
});

test("buildRollStatusChangeEvent returns null when no status is present", () => {
  const event = buildRollStatusChangeEvent({
    occurredAt: "2026-02-01T10:00:00.000Z",
    entityId: 22,
  });

  assert.equal(event, null);
});
