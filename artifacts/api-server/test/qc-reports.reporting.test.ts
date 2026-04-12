import test from "node:test";
import assert from "node:assert/strict";
import { GetQcReportSummaryResponse } from "@workspace/api-zod";
import { buildQcReportSummary } from "../src/routes/qc-reports.reporting";

test("QC report summary calculates failure rate from all QC outcomes", () => {
  const summary = buildQcReportSummary({
    total: 10,
    passed: 6,
    failed: 2,
    pending: 1,
    rework: 1,
  }, {
    from: "2026-01-01",
    to: "2026-01-31",
  });

  assert.equal(summary.failureRate, 0.2);
  assert.deepEqual(summary.period, { from: "2026-01-01", to: "2026-01-31" });
  assert.equal(GetQcReportSummaryResponse.parse(summary).rework, 1);
});

test("QC report summary handles no-result periods safely", () => {
  const summary = buildQcReportSummary({
    total: 0,
    passed: 0,
    failed: 0,
    pending: 0,
    rework: 0,
  });

  assert.deepEqual(summary, {
    total: 0,
    passed: 0,
    failed: 0,
    pending: 0,
    rework: 0,
    failureRate: 0,
    period: { from: null, to: null },
  });
});
