export type QcOutcomeCounts = {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  rework: number;
};

export function buildQcReportSummary(
  counts: QcOutcomeCounts,
  period: { from?: string | null; to?: string | null } = {},
) {
  return {
    total: counts.total,
    passed: counts.passed,
    failed: counts.failed,
    pending: counts.pending,
    rework: counts.rework,
    failureRate: counts.total === 0 ? 0 : Number((counts.failed / counts.total).toFixed(4)),
    period: {
      from: period.from ?? null,
      to: period.to ?? null,
    },
  };
}
