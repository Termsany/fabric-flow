import { Router } from "express";
import { db, fabricRollsTable, auditLogsTable } from "@workspace/db";
import { eq, and, desc, ilike, SQL } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  ListFabricRollsQueryParams,
  ListFabricRollsResponse,
  GetFabricRollParams,
  GetFabricRollResponse,
  UpdateFabricRollParams,
  UpdateFabricRollBody,
  UpdateFabricRollResponse,
  GetFabricRollByCodeParams,
  GetFabricRollByCodeResponse,
} from "@workspace/api-zod";

const router = Router();

function formatRoll(r: typeof fabricRollsTable.$inferSelect) {
  return {
    id: r.id,
    tenantId: r.tenantId,
    rollCode: r.rollCode,
    batchId: r.batchId,
    productionOrderId: r.productionOrderId,
    warehouseId: r.warehouseId ?? null,
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

router.get("/fabric-rolls", requireAuth, async (req, res): Promise<void> => {
  const params = ListFabricRollsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions: SQL[] = [eq(fabricRollsTable.tenantId, req.user!.tenantId)];

  if (params.data.status) conditions.push(eq(fabricRollsTable.status, params.data.status));
  if (params.data.color) conditions.push(ilike(fabricRollsTable.color, `%${params.data.color}%`));
  if (params.data.productionOrderId) conditions.push(eq(fabricRollsTable.productionOrderId, params.data.productionOrderId));
  if (params.data.warehouseId) conditions.push(eq(fabricRollsTable.warehouseId, params.data.warehouseId));
  if (params.data.search) conditions.push(ilike(fabricRollsTable.rollCode, `%${params.data.search}%`));

  const rolls = await db.select().from(fabricRollsTable)
    .where(and(...conditions))
    .orderBy(desc(fabricRollsTable.createdAt))
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  res.json(ListFabricRollsResponse.parse(rolls.map(formatRoll)));
});

router.get("/fabric-rolls/by-code/:rollCode", requireAuth, async (req, res): Promise<void> => {
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

  res.json(GetFabricRollByCodeResponse.parse(formatRoll(roll)));
});

router.get("/fabric-rolls/:id", requireAuth, async (req, res): Promise<void> => {
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

  res.json(GetFabricRollResponse.parse(formatRoll(roll)));
});

router.patch("/fabric-rolls/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateFabricRollParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateFabricRollBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status != null) updates.status = parsed.data.status;
  if (parsed.data.warehouseId != null) updates.warehouseId = parsed.data.warehouseId;
  if (parsed.data.color != null) updates.color = parsed.data.color;
  if (parsed.data.length != null) updates.length = parsed.data.length;
  if (parsed.data.weight != null) updates.weight = parsed.data.weight;
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;

  const [roll] = await db.update(fabricRollsTable).set(updates).where(
    and(eq(fabricRollsTable.id, params.data.id), eq(fabricRollsTable.tenantId, req.user!.tenantId))
  ).returning();

  if (!roll) {
    res.status(404).json({ error: "Fabric roll not found" });
    return;
  }

  await db.insert(auditLogsTable).values({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    entityType: "fabric_roll",
    entityId: roll.id,
    action: "UPDATE",
    changes: JSON.stringify(updates),
  });

  res.json(UpdateFabricRollResponse.parse(formatRoll(roll)));
});

export default router;
