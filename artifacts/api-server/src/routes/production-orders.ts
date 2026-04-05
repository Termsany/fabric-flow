import { Router } from "express";
import { db, productionOrdersTable, fabricRollsTable, auditLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  ListProductionOrdersQueryParams,
  ListProductionOrdersResponse,
  CreateProductionOrderBody,
  GetProductionOrderParams,
  GetProductionOrderResponse,
  UpdateProductionOrderParams,
  UpdateProductionOrderBody,
  UpdateProductionOrderResponse,
} from "@workspace/api-zod";

const router = Router();

function formatOrder(o: typeof productionOrdersTable.$inferSelect) {
  return {
    id: o.id,
    tenantId: o.tenantId,
    orderNumber: o.orderNumber,
    fabricType: o.fabricType,
    gsm: o.gsm,
    width: o.width,
    rawColor: o.rawColor,
    quantity: o.quantity,
    status: o.status,
    notes: o.notes ?? null,
    rollsGenerated: o.rollsGenerated,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

router.get("/production-orders", requireAuth, async (req, res): Promise<void> => {
  const params = ListProductionOrdersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(productionOrdersTable).where(eq(productionOrdersTable.tenantId, req.user!.tenantId)).$dynamic();

  if (params.data.status) {
    const orders = await db.select().from(productionOrdersTable).where(
      and(eq(productionOrdersTable.tenantId, req.user!.tenantId), eq(productionOrdersTable.status, params.data.status))
    ).orderBy(desc(productionOrdersTable.createdAt));
    res.json(ListProductionOrdersResponse.parse(orders.map(formatOrder)));
    return;
  }

  const orders = await db.select().from(productionOrdersTable)
    .where(eq(productionOrdersTable.tenantId, req.user!.tenantId))
    .orderBy(desc(productionOrdersTable.createdAt))
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  res.json(ListProductionOrdersResponse.parse(orders.map(formatOrder)));
});

router.post("/production-orders", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProductionOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fabricType, gsm, width, rawColor, quantity, notes } = parsed.data;

  // Generate unique order number
  const orderNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const batchId = `BATCH-${Date.now()}`;

  const [order] = await db.insert(productionOrdersTable).values({
    tenantId: req.user!.tenantId,
    orderNumber,
    fabricType,
    gsm,
    width,
    rawColor,
    quantity,
    status: "IN_PROGRESS",
    notes: notes ?? null,
    rollsGenerated: quantity,
  }).returning();

  // Auto-generate fabric rolls
  const rollsToInsert = Array.from({ length: quantity }, (_, i) => {
    const rollCode = `${orderNumber}-R${String(i + 1).padStart(3, "0")}`;
    return {
      tenantId: req.user!.tenantId,
      rollCode,
      batchId,
      productionOrderId: order.id,
      warehouseId: null,
      length: Math.round((Math.random() * 30 + 20) * 10) / 10, // 20-50 meters
      weight: Math.round((Math.random() * 20 + 10) * 10) / 10, // 10-30 kg
      color: rawColor,
      gsm,
      width,
      fabricType,
      status: "IN_PRODUCTION",
      qrCode: rollCode,
      notes: null,
    };
  });

  await db.insert(fabricRollsTable).values(rollsToInsert);

  // Audit log
  await db.insert(auditLogsTable).values({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    entityType: "production_order",
    entityId: order.id,
    action: "CREATE",
    changes: JSON.stringify({ orderNumber, quantity }),
  });

  res.status(201).json(GetProductionOrderResponse.parse(formatOrder(order)));
});

router.get("/production-orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProductionOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [order] = await db.select().from(productionOrdersTable).where(
    and(eq(productionOrdersTable.id, params.data.id), eq(productionOrdersTable.tenantId, req.user!.tenantId))
  );

  if (!order) {
    res.status(404).json({ error: "Production order not found" });
    return;
  }

  res.json(GetProductionOrderResponse.parse(formatOrder(order)));
});

router.patch("/production-orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProductionOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateProductionOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status != null) updates.status = parsed.data.status;
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;

  const [order] = await db.update(productionOrdersTable).set(updates).where(
    and(eq(productionOrdersTable.id, params.data.id), eq(productionOrdersTable.tenantId, req.user!.tenantId))
  ).returning();

  if (!order) {
    res.status(404).json({ error: "Production order not found" });
    return;
  }

  await db.insert(auditLogsTable).values({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    entityType: "production_order",
    entityId: order.id,
    action: "UPDATE",
    changes: JSON.stringify(updates),
  });

  res.json(UpdateProductionOrderResponse.parse(formatOrder(order)));
});

export default router;
