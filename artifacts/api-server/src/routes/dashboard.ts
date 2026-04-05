import { Router } from "express";
import { db, fabricRollsTable, productionOrdersTable, dyeingOrdersTable, salesOrdersTable, customersTable, auditLogsTable, usersTable } from "@workspace/db";
import { eq, and, count, desc, sql, gte } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { checkPlanAccess } from "../lib/billing";
import {
  GetDashboardStatsResponse,
  GetRollStatusBreakdownResponse,
  GetRecentActivityQueryParams,
  GetRecentActivityResponse,
  GetProductionByMonthResponse,
  ListAuditLogsQueryParams,
  ListAuditLogsResponse,
} from "@workspace/api-zod";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;

  const [rollCounts] = await db.select({
    total: count(),
    inProduction: sql<number>`count(*) filter (where status = 'IN_PRODUCTION')`.mapWith(Number),
    inQcPending: sql<number>`count(*) filter (where status = 'QC_PENDING')`.mapWith(Number),
    qcPassed: sql<number>`count(*) filter (where status = 'QC_PASSED')`.mapWith(Number),
    qcFailed: sql<number>`count(*) filter (where status = 'QC_FAILED')`.mapWith(Number),
    inDyeing: sql<number>`count(*) filter (where status in ('SENT_TO_DYEING', 'IN_DYEING'))`.mapWith(Number),
    inStock: sql<number>`count(*) filter (where status = 'IN_STOCK')`.mapWith(Number),
    reserved: sql<number>`count(*) filter (where status = 'RESERVED')`.mapWith(Number),
    sold: sql<number>`count(*) filter (where status = 'SOLD')`.mapWith(Number),
  }).from(fabricRollsTable).where(eq(fabricRollsTable.tenantId, tenantId));

  const [productionCounts] = await db.select({
    active: sql<number>`count(*) filter (where status = 'IN_PROGRESS')`.mapWith(Number),
  }).from(productionOrdersTable).where(eq(productionOrdersTable.tenantId, tenantId));

  const [dyeingCounts] = await db.select({
    active: sql<number>`count(*) filter (where status not in ('COMPLETED', 'CANCELLED'))`.mapWith(Number),
  }).from(dyeingOrdersTable).where(eq(dyeingOrdersTable.tenantId, tenantId));

  const [salesCounts] = await db.select({
    pending: sql<number>`count(*) filter (where status in ('DRAFT', 'CONFIRMED'))`.mapWith(Number),
  }).from(salesOrdersTable).where(eq(salesOrdersTable.tenantId, tenantId));

  const [customerCounts] = await db.select({ total: count() }).from(customersTable).where(eq(customersTable.tenantId, tenantId));

  res.json(GetDashboardStatsResponse.parse({
    totalRolls: rollCounts.total,
    inProduction: rollCounts.inProduction,
    inQcPending: rollCounts.inQcPending,
    qcPassed: rollCounts.qcPassed,
    qcFailed: rollCounts.qcFailed,
    inDyeing: rollCounts.inDyeing,
    inStock: rollCounts.inStock,
    reserved: rollCounts.reserved,
    sold: rollCounts.sold,
    activeProductionOrders: productionCounts.active,
    activeDyeingOrders: dyeingCounts.active,
    pendingSalesOrders: salesCounts.pending,
    totalCustomers: customerCounts.total,
  }));
});

router.get("/dashboard/roll-status-breakdown", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;

  const results = await db.select({
    status: fabricRollsTable.status,
    count: count(),
  }).from(fabricRollsTable)
    .where(eq(fabricRollsTable.tenantId, tenantId))
    .groupBy(fabricRollsTable.status);

  res.json(GetRollStatusBreakdownResponse.parse(results.map(r => ({ status: r.status, count: r.count }))));
});

router.get("/dashboard/recent-activity", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = GetRecentActivityQueryParams.safeParse(req.query);
  const tenantId = req.user!.tenantId;
  const limit = params.success ? (params.data.limit ?? 20) : 20;

  const logs = await db.select({
    id: auditLogsTable.id,
    entityType: auditLogsTable.entityType,
    entityId: auditLogsTable.entityId,
    action: auditLogsTable.action,
    changes: auditLogsTable.changes,
    userId: auditLogsTable.userId,
    createdAt: auditLogsTable.createdAt,
    userName: usersTable.fullName,
  }).from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .where(eq(auditLogsTable.tenantId, tenantId))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit);

  const activities = logs.map(l => ({
    id: l.id,
    entityType: l.entityType,
    entityId: l.entityId,
    action: l.action,
    description: `${l.action} ${l.entityType} #${l.entityId}`,
    userId: l.userId ?? null,
    userName: l.userName ?? null,
    createdAt: l.createdAt.toISOString(),
  }));

  res.json(GetRecentActivityResponse.parse(activities));
});

router.get("/dashboard/production-by-month", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const results = await db.select({
    month: sql<string>`to_char(created_at, 'YYYY-MM')`,
    count: count(),
  }).from(productionOrdersTable)
    .where(and(eq(productionOrdersTable.tenantId, tenantId), gte(productionOrdersTable.createdAt, sixMonthsAgo)))
    .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
    .orderBy(sql`to_char(created_at, 'YYYY-MM')`);

  res.json(GetProductionByMonthResponse.parse(results.map(r => ({ month: r.month, count: r.count }))));
});

router.get("/audit-logs", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = ListAuditLogsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [eq(auditLogsTable.tenantId, req.user!.tenantId)];
  if (params.data.entityType) conditions.push(eq(auditLogsTable.entityType, params.data.entityType));
  if (params.data.entityId) conditions.push(eq(auditLogsTable.entityId, params.data.entityId));

  const logs = await db.select().from(auditLogsTable)
    .where(and(...conditions))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  res.json(ListAuditLogsResponse.parse(logs.map(l => ({
    id: l.id,
    tenantId: l.tenantId,
    userId: l.userId ?? null,
    entityType: l.entityType,
    entityId: l.entityId,
    action: l.action,
    changes: l.changes ?? null,
    createdAt: l.createdAt.toISOString(),
  }))));
});

export default router;
