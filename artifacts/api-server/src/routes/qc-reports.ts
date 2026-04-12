import { Router } from "express";
import { db, qcReportsTable, fabricRollsTable, auditLogsTable } from "@workspace/db";
import { getFabricRollStatusFromQcResult } from "@workspace/api-zod";
import { eq, and, desc, gte, lte, sql, count } from "drizzle-orm";
import { requireAuth, requireTenantRole } from "../lib/auth";
import { checkPlanAccess } from "../lib/billing";
import { formatValidationError } from "../lib/request-validation";
import {
  ListQcReportsQueryParams,
  ListQcReportsResponse,
  GetQcReportSummaryQueryParams,
  GetQcReportSummaryResponse,
  GetQcReportParams,
  GetQcReportResponse,
  UpdateQcReportParams,
  UpdateQcReportResponse,
} from "@workspace/api-zod";
import {
  parseCreateQcReportBody,
  parseUpdateQcReportBody,
} from "./operational-workflow.validation";
import {
  assertRollCanReceiveQc,
  buildQcDecision,
  QcWorkflowError,
} from "./qc-reports.workflow";
import { buildAuditChanges, pickAuditFields } from "../utils/audit-log";
import { buildQcReportSummary } from "./qc-reports.reporting";

const router = Router();

function formatReport(
  r: typeof qcReportsTable.$inferSelect,
  roll?: typeof fabricRollsTable.$inferSelect,
) {
  const decision = buildQcDecision(r.result);

  return {
    id: r.id,
    tenantId: r.tenantId,
    fabricRollId: r.fabricRollId,
    inspectedById: r.inspectedById,
    result: r.result,
    defects: r.defects ?? null,
    defectCount: r.defectCount,
    images: r.images ?? [],
    notes: r.notes ?? null,
    inspectedAt: r.inspectedAt.toISOString(),
    workflow: decision,
    traceability: roll ? {
      fabricRoll: {
        id: roll.id,
        rollCode: roll.rollCode,
        status: roll.status,
        productionOrderId: roll.productionOrderId,
      },
    } : undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function respondQcWorkflowError(
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  error: unknown,
): boolean {
  if (error instanceof QcWorkflowError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }

  return false;
}

function parseOptionalDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

router.get("/qc-reports", requireAuth, requireTenantRole(["qc_user"]), checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = ListQcReportsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: formatValidationError(params.error) });
    return;
  }

  const conditions = [eq(qcReportsTable.tenantId, req.user!.tenantId)];
  if (params.data.fabricRollId) conditions.push(eq(qcReportsTable.fabricRollId, params.data.fabricRollId));
  if (params.data.result) conditions.push(eq(qcReportsTable.result, params.data.result));

  const reports = await db.select().from(qcReportsTable)
    .where(and(...conditions))
    .orderBy(desc(qcReportsTable.createdAt))
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  res.json(ListQcReportsResponse.parse(reports.map((report) => formatReport(report))));
});

router.get("/qc-reports/summary", requireAuth, requireTenantRole(["qc_user"]), checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = GetQcReportSummaryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: formatValidationError(params.error) });
    return;
  }

  const conditions = [eq(qcReportsTable.tenantId, req.user!.tenantId)];
  const fromDate = parseOptionalDate(params.data.from);
  const toDate = parseOptionalDate(params.data.to);
  if ((params.data.from && !fromDate) || (params.data.to && !toDate)) {
    res.status(400).json({ error: "Invalid date range" });
    return;
  }

  if (fromDate) {
    conditions.push(gte(qcReportsTable.inspectedAt, fromDate));
  }
  if (toDate) {
    conditions.push(lte(qcReportsTable.inspectedAt, toDate));
  }

  const [summary] = await db.select({
    total: count(),
    passed: sql<number>`count(*) filter (where result = 'PASS')`.mapWith(Number),
    failed: sql<number>`count(*) filter (where result = 'FAIL')`.mapWith(Number),
    pending: sql<number>`count(*) filter (where result = 'PENDING')`.mapWith(Number),
    rework: sql<number>`count(*) filter (where result = 'REWORK')`.mapWith(Number),
  }).from(qcReportsTable).where(and(...conditions));

  res.json(GetQcReportSummaryResponse.parse(buildQcReportSummary(summary, {
    from: params.data.from ?? null,
    to: params.data.to ?? null,
  })));
});

router.post("/qc-reports", requireAuth, requireTenantRole(["qc_user"]), checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const parsed = parseCreateQcReportBody(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatValidationError(parsed.error) });
    return;
  }

  const { fabricRollId, result, defects, defectCount, images, notes } = parsed.data;

  try {
    const created = await db.transaction(async (tx) => {
      const [roll] = await tx.select().from(fabricRollsTable).where(
        and(eq(fabricRollsTable.id, fabricRollId), eq(fabricRollsTable.tenantId, req.user!.tenantId))
      );

      if (!roll) {
        return null;
      }

      assertRollCanReceiveQc(roll);

      const decision = buildQcDecision(result);
      const [report] = await tx.insert(qcReportsTable).values({
        tenantId: req.user!.tenantId,
        fabricRollId,
        inspectedById: req.user!.userId,
        result: decision.result,
        defects: defects ?? null,
        defectCount: defectCount ?? 0,
        images: images ?? [],
        notes: notes ?? null,
        inspectedAt: new Date(),
      }).returning();

      const [updatedRoll] = await tx.update(fabricRollsTable).set({ status: decision.rollStatus }).where(
        and(eq(fabricRollsTable.id, fabricRollId), eq(fabricRollsTable.tenantId, req.user!.tenantId))
      ).returning();

      await tx.insert(auditLogsTable).values({
        tenantId: req.user!.tenantId,
        userId: req.user!.userId,
        entityType: "qc_report",
        entityId: report.id,
        action: "CREATE",
        changes: JSON.stringify({
          result: decision.result,
          defectCount,
          fabricRollId,
          productionOrderId: roll.productionOrderId,
          previousRollStatus: roll.status,
          nextRollStatus: decision.rollStatus,
        }),
      });

      return { report, roll: updatedRoll };
    });

    if (!created) {
      res.status(404).json({ error: "Fabric roll not found" });
      return;
    }

    res.status(201).json(GetQcReportResponse.parse(formatReport(created.report, created.roll)));
  } catch (error) {
    if (respondQcWorkflowError(res, error)) {
      return;
    }

    throw error;
  }
});

router.get("/qc-reports/:id", requireAuth, requireTenantRole(["qc_user"]), checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = GetQcReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [report] = await db.select().from(qcReportsTable).where(
    and(eq(qcReportsTable.id, params.data.id), eq(qcReportsTable.tenantId, req.user!.tenantId))
  );

  if (!report) {
    res.status(404).json({ error: "QC report not found" });
    return;
  }

  res.json(GetQcReportResponse.parse(formatReport(report)));
});

router.patch("/qc-reports/:id", requireAuth, requireTenantRole(["qc_user"]), checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = UpdateQcReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = parseUpdateQcReportBody(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatValidationError(parsed.error) });
    return;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(qcReportsTable).where(
        and(eq(qcReportsTable.id, params.data.id), eq(qcReportsTable.tenantId, req.user!.tenantId))
      );

      if (!existing) {
        return null;
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.result != null) updates.result = parsed.data.result;
      if (parsed.data.defects != null) updates.defects = parsed.data.defects;
      if (parsed.data.defectCount != null) updates.defectCount = parsed.data.defectCount;
      if (parsed.data.notes != null) updates.notes = parsed.data.notes;

      const [report] = await tx.update(qcReportsTable).set(updates).where(
        and(eq(qcReportsTable.id, params.data.id), eq(qcReportsTable.tenantId, req.user!.tenantId))
      ).returning();

      const [roll] = await tx.select().from(fabricRollsTable).where(
        and(eq(fabricRollsTable.id, report.fabricRollId), eq(fabricRollsTable.tenantId, req.user!.tenantId))
      );

      if (parsed.data.result != null && roll) {
        assertRollCanReceiveQc(roll);

        const newStatus = getFabricRollStatusFromQcResult(parsed.data.result);
        const [updatedRoll] = await tx.update(fabricRollsTable).set({ status: newStatus }).where(
          and(eq(fabricRollsTable.id, report.fabricRollId), eq(fabricRollsTable.tenantId, req.user!.tenantId))
        ).returning();

        await tx.insert(auditLogsTable).values({
          tenantId: req.user!.tenantId,
          userId: req.user!.userId,
          entityType: "qc_report",
          entityId: report.id,
          action: existing.result !== report.result ? "QC_DECISION_UPDATED" : "UPDATE",
          changes: buildAuditChanges({
            before: {
              ...pickAuditFields(existing, ["result", "defectCount", "notes"]),
              fabricRollStatus: roll.status,
            },
            after: {
              ...pickAuditFields(report, ["result", "defectCount", "notes"]),
              fabricRollStatus: updatedRoll.status,
            },
            context: {
              fabricRollId: report.fabricRollId,
              productionOrderId: roll.productionOrderId,
            },
          }),
        });

        return { report, roll: updatedRoll };
      }

      await tx.insert(auditLogsTable).values({
        tenantId: req.user!.tenantId,
        userId: req.user!.userId,
        entityType: "qc_report",
        entityId: report.id,
        action: "UPDATE",
        changes: buildAuditChanges({
          before: pickAuditFields(existing, ["result", "defectCount", "notes"]),
          after: pickAuditFields(report, ["result", "defectCount", "notes"]),
          context: { fabricRollId: report.fabricRollId },
        }),
      });

      return { report, roll };
    });

    if (!updated) {
      res.status(404).json({ error: "QC report not found" });
      return;
    }

    res.json(UpdateQcReportResponse.parse(formatReport(updated.report, updated.roll)));
  } catch (error) {
    if (respondQcWorkflowError(res, error)) {
      return;
    }

    throw error;
  }
});

export default router;
