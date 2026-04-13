import test from "node:test";
import assert from "node:assert/strict";
import { computeNextBatchId, mapProductionOrderCreateError } from "./production-orders";

test("mapProductionOrderCreateError detects missing batch_id column", () => {
  const mapped = mapProductionOrderCreateError({ code: "42703", message: "column \"batch_id\" does not exist" });
  assert.ok(mapped);
  assert.equal(mapped?.status, 500);
});

test("mapProductionOrderCreateError handles missing required fields", () => {
  const mapped = mapProductionOrderCreateError({ code: "23502", message: "null value in column" });
  assert.deepEqual(mapped, {
    status: 400,
    message: "Required production order fields are missing.",
  });
});

test("mapProductionOrderCreateError handles invalid types", () => {
  const mapped = mapProductionOrderCreateError({ code: "22P02", message: "invalid input syntax for type integer" });
  assert.deepEqual(mapped, {
    status: 400,
    message: "Production order fields have invalid types.",
  });
});

test("computeNextBatchId increments sequence for current year", () => {
  const now = new Date("2026-04-13T10:00:00.000Z");
  assert.equal(computeNextBatchId("BATCH-2026-0009", now), "BATCH-2026-0010");
});

test("computeNextBatchId resets sequence when year changes", () => {
  const now = new Date("2026-04-13T10:00:00.000Z");
  assert.equal(computeNextBatchId("BATCH-2025-0999", now), "BATCH-2026-0001");
});
