import { Router } from "express";
import { db, qcReportsTable, fabricRollsTable, auditLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { checkPlanAccess } from "../lib/billing";
import {
  ListQcReportsQueryParams,
  ListQcReportsResponse,
  CreateQcReportBody,
  GetQcReportParams,
  GetQcReportResponse,
  UpdateQcReportParams,
  UpdateQcReportBody,
  UpdateQcReportResponse,
} from "@workspace/api-zod";

const router = Router();

function formatReport(r: typeof qcReportsTable.$inferSelect) {
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
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/qc-reports", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = ListQcReportsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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

  res.json(ListQcReportsResponse.parse(reports.map(formatReport)));
});

router.post("/qc-reports", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const parsed = CreateQcReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fabricRollId, result, defects, defectCount, images, notes } = parsed.data;
  const [roll] = await db.select().from(fabricRollsTable).where(
    and(eq(fabricRollsTable.id, fabricRollId), eq(fabricRollsTable.tenantId, req.user!.tenantId))
  );

  if (!roll) {
    res.status(404).json({ error: "Fabric roll not found" });
    return;
  }

  const [report] = await db.insert(qcReportsTable).values({
    tenantId: req.user!.tenantId,
    fabricRollId,
    inspectedById: req.user!.userId,
    result,
    defects: defects ?? null,
    defectCount: defectCount ?? 0,
    images: images ?? [],
    notes: notes ?? null,
    inspectedAt: new Date(),
  }).returning();

  // Update roll status based on QC result
  const newStatus = result === "PASS" ? "QC_PASSED" : result === "FAIL" ? "QC_FAILED" : "QC_PENDING";
  await db.update(fabricRollsTable).set({ status: newStatus }).where(
    and(eq(fabricRollsTable.id, fabricRollId), eq(fabricRollsTable.tenantId, req.user!.tenantId))
  );

  await db.insert(auditLogsTable).values({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    entityType: "qc_report",
    entityId: report.id,
    action: "CREATE",
    changes: JSON.stringify({ result, defectCount }),
  });

  res.status(201).json(GetQcReportResponse.parse(formatReport(report)));
});

router.get("/qc-reports/:id", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
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

router.patch("/qc-reports/:id", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = UpdateQcReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateQcReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.result != null) updates.result = parsed.data.result;
  if (parsed.data.defects != null) updates.defects = parsed.data.defects;
  if (parsed.data.defectCount != null) updates.defectCount = parsed.data.defectCount;
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;

  const [report] = await db.update(qcReportsTable).set(updates).where(
    and(eq(qcReportsTable.id, params.data.id), eq(qcReportsTable.tenantId, req.user!.tenantId))
  ).returning();

  if (!report) {
    res.status(404).json({ error: "QC report not found" });
    return;
  }

  res.json(UpdateQcReportResponse.parse(formatReport(report)));
});

export default router;
