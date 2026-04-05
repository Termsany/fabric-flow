import { Router } from "express";
import { db, dyeingOrdersTable, fabricRollsTable, auditLogsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { checkPlanAccess } from "../lib/billing";
import {
  ListDyeingOrdersQueryParams,
  ListDyeingOrdersResponse,
  CreateDyeingOrderBody,
  GetDyeingOrderParams,
  GetDyeingOrderResponse,
  UpdateDyeingOrderParams,
  UpdateDyeingOrderBody,
  UpdateDyeingOrderResponse,
} from "@workspace/api-zod";

const router = Router();

function formatOrder(o: typeof dyeingOrdersTable.$inferSelect) {
  return {
    id: o.id,
    tenantId: o.tenantId,
    orderNumber: o.orderNumber,
    dyehouseName: o.dyehouseName,
    targetColor: o.targetColor,
    targetShade: o.targetShade ?? null,
    status: o.status,
    sentAt: o.sentAt?.toISOString() ?? null,
    receivedAt: o.receivedAt?.toISOString() ?? null,
    notes: o.notes ?? null,
    rollIds: o.rollIds ?? [],
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

router.get("/dyeing-orders", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = ListDyeingOrdersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [eq(dyeingOrdersTable.tenantId, req.user!.tenantId)];
  if (params.data.status) conditions.push(eq(dyeingOrdersTable.status, params.data.status));

  const orders = await db.select().from(dyeingOrdersTable)
    .where(and(...conditions))
    .orderBy(desc(dyeingOrdersTable.createdAt))
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  res.json(ListDyeingOrdersResponse.parse(orders.map(formatOrder)));
});

router.post("/dyeing-orders", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const parsed = CreateDyeingOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { dyehouseName, targetColor, targetShade, rollIds, notes } = parsed.data;
  const orderNumber = `DYE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  if (rollIds && rollIds.length > 0) {
    const tenantRolls = await db.select({ id: fabricRollsTable.id }).from(fabricRollsTable).where(
      and(inArray(fabricRollsTable.id, rollIds), eq(fabricRollsTable.tenantId, req.user!.tenantId))
    );

    if (tenantRolls.length !== rollIds.length) {
      res.status(400).json({ error: "One or more selected rolls do not belong to this tenant" });
      return;
    }
  }

  const [order] = await db.insert(dyeingOrdersTable).values({
    tenantId: req.user!.tenantId,
    orderNumber,
    dyehouseName,
    targetColor,
    targetShade: targetShade ?? null,
    status: "PENDING",
    rollIds: rollIds ?? [],
    notes: notes ?? null,
    sentAt: null,
    receivedAt: null,
  }).returning();

  // Update rolls status to SENT_TO_DYEING
  if (rollIds && rollIds.length > 0) {
    await db.update(fabricRollsTable).set({ status: "SENT_TO_DYEING" })
      .where(and(inArray(fabricRollsTable.id, rollIds), eq(fabricRollsTable.tenantId, req.user!.tenantId)));
  }

  await db.insert(auditLogsTable).values({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    entityType: "dyeing_order",
    entityId: order.id,
    action: "CREATE",
    changes: JSON.stringify({ orderNumber, rollCount: rollIds?.length ?? 0 }),
  });

  res.status(201).json(GetDyeingOrderResponse.parse(formatOrder(order)));
});

router.get("/dyeing-orders/:id", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = GetDyeingOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [order] = await db.select().from(dyeingOrdersTable).where(
    and(eq(dyeingOrdersTable.id, params.data.id), eq(dyeingOrdersTable.tenantId, req.user!.tenantId))
  );

  if (!order) {
    res.status(404).json({ error: "Dyeing order not found" });
    return;
  }

  res.json(GetDyeingOrderResponse.parse(formatOrder(order)));
});

router.patch("/dyeing-orders/:id", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = UpdateDyeingOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateDyeingOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status != null) updates.status = parsed.data.status;
  if (parsed.data.targetShade != null) updates.targetShade = parsed.data.targetShade;
  if (parsed.data.receivedAt != null) updates.receivedAt = new Date(parsed.data.receivedAt);
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;

  const [order] = await db.update(dyeingOrdersTable).set(updates).where(
    and(eq(dyeingOrdersTable.id, params.data.id), eq(dyeingOrdersTable.tenantId, req.user!.tenantId))
  ).returning();

  if (!order) {
    res.status(404).json({ error: "Dyeing order not found" });
    return;
  }

  // If completed, update rolls to FINISHED
  if (parsed.data.status === "COMPLETED" && order.rollIds && order.rollIds.length > 0) {
    await db.update(fabricRollsTable).set({ status: "FINISHED" })
      .where(and(inArray(fabricRollsTable.id, order.rollIds), eq(fabricRollsTable.tenantId, req.user!.tenantId)));
  }

  res.json(UpdateDyeingOrderResponse.parse(formatOrder(order)));
});

export default router;
