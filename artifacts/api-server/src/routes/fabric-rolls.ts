import { Router } from "express";
import {
  db,
  auditLogsTable,
  fabricRollsTable,
  warehousesTable,
  productionOrdersTable,
  qcReportsTable,
  warehouseMovementsTable,
  dyeingOrdersTable,
  salesOrdersTable,
} from "@workspace/db";
import { eq, and, desc, ilike, SQL, sql, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { requireOperationalAccess } from "../lib/tenant-rbac";
import { formatValidationError } from "../lib/request-validation";
import {
  ListFabricRollsQueryParams,
  ListFabricRollsResponse,
  GetFabricRollParams,
  GetFabricRollResponse,
  UpdateFabricRollParams,
  UpdateFabricRollResponse,
  GetFabricRollByCodeParams,
  GetFabricRollByCodeResponse,
} from "@workspace/api-zod";
import { parseUpdateFabricRollBody } from "./operational-workflow.validation";
import {
  buildFabricRollDetailResponse,
  buildRollStatusChangeEvent,
  sortFabricRollTimeline,
  type FabricRollTimelineEvent,
} from "./fabric-rolls.workflow";
import { pickAuditFields, writeOperationalAuditLog } from "../utils/audit-log";
import { normalizeIdentifierSearch } from "../utils/identifiers";
import { assertFabricRollTransitionAllowed, WorkflowTransitionError } from "../modules/workflow/transition-guards";

const router = Router();

function respondWorkflowTransitionError(
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  error: unknown,
): boolean {
  if (error instanceof WorkflowTransitionError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }

  return false;
}

function formatRollBase(r: typeof fabricRollsTable.$inferSelect) {
  return {
    id: r.id,
    tenantId: r.tenantId,
    rollCode: r.rollCode,
    batchId: r.batchId,
    productionOrderId: r.productionOrderId,
    warehouseId: r.warehouseId ?? null,
    warehouseLocationId: r.warehouseLocationId ?? null,
    length: r.length,
    weight: r.weight,
    color: r.color,
    gsm: r.gsm,
    width: r.width,
    fabricType: r.fabricType,
    status: r.status,
    qrCode: r.qrCode,
    notes: r.notes ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function loadFabricRollTraceability(
  tenantId: number,
  roll: typeof fabricRollsTable.$inferSelect,
) {
  const [productionOrder, currentWarehouse, latestQc, latestMovement, latestDyeingOrder, latestSalesOrder] =
    await Promise.all([
      db.select({
        id: productionOrdersTable.id,
        orderNumber: productionOrdersTable.orderNumber,
        status: productionOrdersTable.status,
      }).from(productionOrdersTable).where(
        and(
          eq(productionOrdersTable.id, roll.productionOrderId),
          eq(productionOrdersTable.tenantId, tenantId),
        ),
      ).limit(1),
      roll.warehouseId == null
        ? Promise.resolve([])
        : db.select({
          id: warehousesTable.id,
          name: warehousesTable.name,
          location: warehousesTable.location,
        }).from(warehousesTable).where(
          and(eq(warehousesTable.id, roll.warehouseId), eq(warehousesTable.tenantId, tenantId)),
        ).limit(1),
      db.select({
        id: qcReportsTable.id,
        result: qcReportsTable.result,
        defectCount: qcReportsTable.defectCount,
        inspectedAt: qcReportsTable.inspectedAt,
        notes: qcReportsTable.notes,
      }).from(qcReportsTable).where(
        and(eq(qcReportsTable.fabricRollId, roll.id), eq(qcReportsTable.tenantId, tenantId)),
      ).orderBy(desc(qcReportsTable.inspectedAt)).limit(1),
      db.select({
        id: warehouseMovementsTable.id,
        fromWarehouseId: warehouseMovementsTable.fromWarehouseId,
        toWarehouseId: warehouseMovementsTable.toWarehouseId,
        movedAt: warehouseMovementsTable.movedAt,
        reason: warehouseMovementsTable.reason,
      }).from(warehouseMovementsTable).where(
        and(eq(warehouseMovementsTable.fabricRollId, roll.id), eq(warehouseMovementsTable.tenantId, tenantId)),
      ).orderBy(desc(warehouseMovementsTable.movedAt)).limit(1),
      db.select({
        id: dyeingOrdersTable.id,
        orderNumber: dyeingOrdersTable.orderNumber,
        status: dyeingOrdersTable.status,
        targetColor: dyeingOrdersTable.targetColor,
      }).from(dyeingOrdersTable).where(
        and(
          eq(dyeingOrdersTable.tenantId, tenantId),
          sql`${roll.id} = ANY(${dyeingOrdersTable.rollIds})`,
        ),
      ).orderBy(desc(dyeingOrdersTable.updatedAt)).limit(1),
      db.select({
        id: salesOrdersTable.id,
        orderNumber: salesOrdersTable.orderNumber,
        status: salesOrdersTable.status,
        customerId: salesOrdersTable.customerId,
      }).from(salesOrdersTable).where(
        and(
          eq(salesOrdersTable.tenantId, tenantId),
          sql`${roll.id} = ANY(${salesOrdersTable.rollIds})`,
        ),
      ).orderBy(desc(salesOrdersTable.updatedAt)).limit(1),
    ]);

  return {
    productionOrder: productionOrder[0]
      ? {
        id: productionOrder[0].id,
        orderNumber: productionOrder[0].orderNumber,
        status: productionOrder[0].status,
      }
      : null,
    currentWarehouse: currentWarehouse[0]
      ? {
        id: currentWarehouse[0].id,
        name: currentWarehouse[0].name,
        location: currentWarehouse[0].location,
      }
      : null,
    latestQc: latestQc[0]
      ? {
        id: latestQc[0].id,
        result: latestQc[0].result,
        defectCount: latestQc[0].defectCount,
        inspectedAt: latestQc[0].inspectedAt.toISOString(),
        notes: latestQc[0].notes ?? null,
      }
      : null,
    latestMovement: latestMovement[0]
      ? {
        id: latestMovement[0].id,
        fromWarehouseId: latestMovement[0].fromWarehouseId ?? null,
        toWarehouseId: latestMovement[0].toWarehouseId ?? null,
        movedAt: latestMovement[0].movedAt.toISOString(),
        reason: latestMovement[0].reason ?? null,
      }
      : null,
    latestDyeingOrder: latestDyeingOrder[0]
      ? {
        id: latestDyeingOrder[0].id,
        orderNumber: latestDyeingOrder[0].orderNumber,
        status: latestDyeingOrder[0].status,
        targetColor: latestDyeingOrder[0].targetColor,
      }
      : null,
    latestSalesOrder: latestSalesOrder[0]
      ? {
        id: latestSalesOrder[0].id,
        orderNumber: latestSalesOrder[0].orderNumber,
        status: latestSalesOrder[0].status,
        customerId: latestSalesOrder[0].customerId,
      }
      : null,
  };
}

async function loadFabricRollTimeline(
  tenantId: number,
  roll: typeof fabricRollsTable.$inferSelect,
) {
  const [productionOrder, qcReports, movements, dyeingOrders, salesOrders, auditLogs] = await Promise.all([
    db.select({
      id: productionOrdersTable.id,
      orderNumber: productionOrdersTable.orderNumber,
      status: productionOrdersTable.status,
      createdAt: productionOrdersTable.createdAt,
    }).from(productionOrdersTable).where(
      and(eq(productionOrdersTable.id, roll.productionOrderId), eq(productionOrdersTable.tenantId, tenantId)),
    ).limit(1),
    db.select({
      id: qcReportsTable.id,
      result: qcReportsTable.result,
      defectCount: qcReportsTable.defectCount,
      inspectedAt: qcReportsTable.inspectedAt,
      notes: qcReportsTable.notes,
    }).from(qcReportsTable).where(
      and(eq(qcReportsTable.fabricRollId, roll.id), eq(qcReportsTable.tenantId, tenantId)),
    ).orderBy(qcReportsTable.inspectedAt),
    db.select({
      id: warehouseMovementsTable.id,
      fromWarehouseId: warehouseMovementsTable.fromWarehouseId,
      toWarehouseId: warehouseMovementsTable.toWarehouseId,
      movedAt: warehouseMovementsTable.movedAt,
      reason: warehouseMovementsTable.reason,
    }).from(warehouseMovementsTable).where(
      and(eq(warehouseMovementsTable.fabricRollId, roll.id), eq(warehouseMovementsTable.tenantId, tenantId)),
    ).orderBy(warehouseMovementsTable.movedAt),
    db.select({
      id: dyeingOrdersTable.id,
      orderNumber: dyeingOrdersTable.orderNumber,
      status: dyeingOrdersTable.status,
      targetColor: dyeingOrdersTable.targetColor,
      targetShade: dyeingOrdersTable.targetShade,
      createdAt: dyeingOrdersTable.createdAt,
      updatedAt: dyeingOrdersTable.updatedAt,
      receivedAt: dyeingOrdersTable.receivedAt,
    }).from(dyeingOrdersTable).where(
      and(eq(dyeingOrdersTable.tenantId, tenantId), sql`${roll.id} = ANY(${dyeingOrdersTable.rollIds})`),
    ).orderBy(dyeingOrdersTable.createdAt),
    db.select({
      id: salesOrdersTable.id,
      orderNumber: salesOrdersTable.orderNumber,
      status: salesOrdersTable.status,
      customerId: salesOrdersTable.customerId,
      createdAt: salesOrdersTable.createdAt,
      updatedAt: salesOrdersTable.updatedAt,
    }).from(salesOrdersTable).where(
      and(eq(salesOrdersTable.tenantId, tenantId), sql`${roll.id} = ANY(${salesOrdersTable.rollIds})`),
    ).orderBy(salesOrdersTable.createdAt),
    db.select({
      id: auditLogsTable.id,
      action: auditLogsTable.action,
      changes: auditLogsTable.changes,
      createdAt: auditLogsTable.createdAt,
    }).from(auditLogsTable).where(
      and(
        eq(auditLogsTable.tenantId, tenantId),
        eq(auditLogsTable.entityType, "fabric_roll"),
        eq(auditLogsTable.entityId, roll.id),
      ),
    ).orderBy(auditLogsTable.createdAt),
  ]);

  const events: FabricRollTimelineEvent[] = [
    {
      occurredAt: roll.createdAt.toISOString(),
      type: "roll_created",
      title: "Fabric roll created",
      description: `Roll ${roll.rollCode} was generated for batch ${roll.batchId}.`,
      status: roll.status,
      entityType: "fabric_roll",
      entityId: roll.id,
      metadata: {
        rollId: roll.id,
        rollCode: roll.rollCode,
        batchId: roll.batchId,
        productionOrderId: roll.productionOrderId,
      },
    },
  ];

  if (productionOrder[0]) {
    events.push({
      occurredAt: productionOrder[0].createdAt.toISOString(),
      type: "production_order",
      title: "Linked to production order",
      description: `Production order ${productionOrder[0].orderNumber} created this roll.`,
      status: productionOrder[0].status,
      entityType: "production_order",
      entityId: productionOrder[0].id,
      metadata: {
        rollId: roll.id,
        rollCode: roll.rollCode,
        orderNumber: productionOrder[0].orderNumber,
      },
    });
  }

  for (const report of qcReports) {
    events.push({
      occurredAt: report.inspectedAt.toISOString(),
      type: "qc_report",
      title: "QC decision recorded",
      description: report.notes ?? `QC result ${report.result} with ${report.defectCount} defects.`,
      status: report.result,
      entityType: "qc_report",
      entityId: report.id,
      metadata: {
        rollId: roll.id,
        rollCode: roll.rollCode,
        defectCount: report.defectCount,
        result: report.result,
      },
    });
  }

  for (const order of dyeingOrders) {
    events.push({
      occurredAt: (order.receivedAt ?? order.updatedAt ?? order.createdAt).toISOString(),
      type: "dyeing_order",
      title: order.status === "COMPLETED" ? "Dyeing completed" : "Dyeing order updated",
      description: `Dyeing order ${order.orderNumber} targeted ${order.targetColor}.`,
      status: order.status,
      entityType: "dyeing_order",
      entityId: order.id,
      metadata: {
        rollId: roll.id,
        rollCode: roll.rollCode,
        orderNumber: order.orderNumber,
        targetColor: order.targetColor,
        targetShade: order.targetShade,
      },
    });
  }

  for (const movement of movements) {
    events.push({
      occurredAt: movement.movedAt.toISOString(),
      type: "warehouse_movement",
      title: "Warehouse movement recorded",
      description: movement.reason ?? "Fabric roll warehouse location changed.",
      status: null,
      entityType: "warehouse_movement",
      entityId: movement.id,
      metadata: {
        rollId: roll.id,
        rollCode: roll.rollCode,
        fromWarehouseId: movement.fromWarehouseId ?? null,
        toWarehouseId: movement.toWarehouseId ?? null,
      },
    });
  }

  for (const order of salesOrders) {
    const isDelivered = order.status === "DELIVERED";
    events.push({
      occurredAt: (isDelivered ? order.updatedAt : order.createdAt).toISOString(),
      type: "sales_order",
      title: isDelivered ? "Sales order delivered" : "Sales order linked",
      description: `Sales order ${order.orderNumber} linked this roll to customer #${order.customerId}.`,
      status: order.status,
      entityType: "sales_order",
      entityId: order.id,
      metadata: {
        rollId: roll.id,
        rollCode: roll.rollCode,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
      },
    });
  }

  const parseAuditChanges = (changes: string | null) => {
    if (!changes) return null;
    try {
      const parsed = JSON.parse(changes) as {
        before?: Record<string, unknown> | null;
        after?: Record<string, unknown> | null;
        context?: Record<string, unknown> | null;
      };
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  };

  for (const log of auditLogs) {
    const parsed = parseAuditChanges(log.changes);
    const beforeStatus = typeof parsed?.before?.status === "string" ? parsed?.before?.status : null;
    const afterStatus = typeof parsed?.after?.status === "string" ? parsed?.after?.status : null;
    const event = buildRollStatusChangeEvent({
      occurredAt: log.createdAt.toISOString(),
      entityId: roll.id,
      beforeStatus,
      afterStatus,
      action: log.action,
      context: parsed?.context ?? null,
    });

    if (event) {
      events.push(event);
    }
  }

  return sortFabricRollTimeline(events);
}

async function formatDetailedRollResponse(
  tenantId: number,
  roll: typeof fabricRollsTable.$inferSelect,
) {
  const [traceability, timeline] = await Promise.all([
    loadFabricRollTraceability(tenantId, roll),
    loadFabricRollTimeline(tenantId, roll),
  ]);

  return buildFabricRollDetailResponse(formatRollBase(roll), traceability, timeline);
}

router.get(
  "/fabric-rolls",
  requireAuth,
  requireOperationalAccess("fabric_rolls", "read"),
  async (req, res): Promise<void> => {
  const params = ListFabricRollsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: formatValidationError(params.error) });
    return;
  }

  const conditions: SQL[] = [eq(fabricRollsTable.tenantId, req.user!.tenantId)];

  if (params.data.status) conditions.push(eq(fabricRollsTable.status, params.data.status));
  if (params.data.color) conditions.push(ilike(fabricRollsTable.color, `%${params.data.color}%`));
  if (params.data.productionOrderId) conditions.push(eq(fabricRollsTable.productionOrderId, params.data.productionOrderId));
  if (params.data.warehouseId) conditions.push(eq(fabricRollsTable.warehouseId, params.data.warehouseId));
  const identifierSearch = normalizeIdentifierSearch(params.data.search);
  if (identifierSearch) {
    const searchConditions = [
      ilike(fabricRollsTable.rollCode, identifierSearch.pattern),
      ilike(fabricRollsTable.batchId, identifierSearch.pattern),
      ilike(fabricRollsTable.qrCode, identifierSearch.pattern),
    ];
    if (identifierSearch.numericId != null) {
      searchConditions.push(eq(fabricRollsTable.id, identifierSearch.numericId));
      searchConditions.push(eq(fabricRollsTable.productionOrderId, identifierSearch.numericId));
    }
    conditions.push(or(...searchConditions)!);
  }

  const rolls = await db.select().from(fabricRollsTable)
    .where(and(...conditions))
    .orderBy(desc(fabricRollsTable.createdAt))
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  res.json(ListFabricRollsResponse.parse(rolls.map(formatRollBase)));
});

router.get(
  "/fabric-rolls/by-code/:rollCode",
  requireAuth,
  requireOperationalAccess("fabric_rolls", "read"),
  async (req, res): Promise<void> => {
  const params = GetFabricRollByCodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid roll code" });
    return;
  }

  const [roll] = await db.select().from(fabricRollsTable).where(
    and(eq(fabricRollsTable.rollCode, params.data.rollCode), eq(fabricRollsTable.tenantId, req.user!.tenantId))
  );

  if (!roll) {
    res.status(404).json({ error: "Fabric roll not found" });
    return;
  }

  res.json(GetFabricRollByCodeResponse.parse(await formatDetailedRollResponse(req.user!.tenantId, roll)));
});

router.get(
  "/fabric-rolls/:id",
  requireAuth,
  requireOperationalAccess("fabric_rolls", "read"),
  async (req, res): Promise<void> => {
  const params = GetFabricRollParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [roll] = await db.select().from(fabricRollsTable).where(
    and(eq(fabricRollsTable.id, params.data.id), eq(fabricRollsTable.tenantId, req.user!.tenantId))
  );

  if (!roll) {
    res.status(404).json({ error: "Fabric roll not found" });
    return;
  }

  res.json(GetFabricRollResponse.parse(await formatDetailedRollResponse(req.user!.tenantId, roll)));
});

router.patch(
  "/fabric-rolls/:id",
  requireAuth,
  requireOperationalAccess("fabric_rolls", "write"),
  async (req, res): Promise<void> => {
  const params = UpdateFabricRollParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = parseUpdateFabricRollBody(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatValidationError(parsed.error) });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status != null) updates.status = parsed.data.status;
  if (parsed.data.warehouseId != null) {
    const [warehouse] = await db.select({ id: warehousesTable.id }).from(warehousesTable).where(
      and(eq(warehousesTable.id, parsed.data.warehouseId), eq(warehousesTable.tenantId, req.user!.tenantId))
    );

    if (!warehouse) {
      res.status(400).json({ error: "Warehouse not found" });
      return;
    }

    updates.warehouseId = parsed.data.warehouseId;
  }
  if (parsed.data.color != null) updates.color = parsed.data.color;
  if (parsed.data.length != null) updates.length = parsed.data.length;
  if (parsed.data.weight != null) updates.weight = parsed.data.weight;
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;

  const [existing] = await db.select().from(fabricRollsTable).where(
    and(eq(fabricRollsTable.id, params.data.id), eq(fabricRollsTable.tenantId, req.user!.tenantId))
  );

  if (!existing) {
    res.status(404).json({ error: "Fabric roll not found" });
    return;
  }

  if (parsed.data.status != null && parsed.data.status !== existing.status) {
    try {
      assertFabricRollTransitionAllowed(existing.status, parsed.data.status);
    } catch (error) {
      if (respondWorkflowTransitionError(res, error)) {
        return;
      }

      throw error;
    }
  }

  const [roll] = await db.update(fabricRollsTable).set(updates).where(
    and(eq(fabricRollsTable.id, params.data.id), eq(fabricRollsTable.tenantId, req.user!.tenantId))
  ).returning();

  const statusChanged = parsed.data.status != null && parsed.data.status !== existing.status;
  const warehouseChanged = parsed.data.warehouseId != null && parsed.data.warehouseId !== existing.warehouseId;

  await writeOperationalAuditLog({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    entityType: "fabric_roll",
    entityId: roll.id,
    action: statusChanged ? "STATUS_CHANGED" : warehouseChanged ? "WAREHOUSE_ASSIGNED" : "UPDATE",
    before: pickAuditFields(existing, ["status", "warehouseId", "color", "length", "weight", "notes"]),
    after: pickAuditFields(roll, ["status", "warehouseId", "color", "length", "weight", "notes"]),
    context: {
      rollCode: roll.rollCode,
      productionOrderId: roll.productionOrderId,
      changedFields: Object.keys(updates),
    },
  });

  res.json(UpdateFabricRollResponse.parse(await formatDetailedRollResponse(req.user!.tenantId, roll)));
});

export default router;
