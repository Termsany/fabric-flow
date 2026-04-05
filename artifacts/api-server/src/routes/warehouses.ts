import { Router } from "express";
import { db, warehousesTable, warehouseMovementsTable, fabricRollsTable, auditLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { checkSubscription, ensureUsageWithinLimit } from "../lib/billing";
import {
  ListWarehousesResponse,
  CreateWarehouseBody,
  GetWarehouseParams,
  GetWarehouseResponse,
  UpdateWarehouseParams,
  UpdateWarehouseBody,
  UpdateWarehouseResponse,
  ListWarehouseMovementsQueryParams,
  ListWarehouseMovementsResponse,
  CreateWarehouseMovementBody,
} from "@workspace/api-zod";

const router = Router();

function formatWarehouse(w: typeof warehousesTable.$inferSelect) {
  return {
    id: w.id,
    tenantId: w.tenantId,
    name: w.name,
    location: w.location,
    capacity: w.capacity ?? null,
    isActive: w.isActive,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

function formatMovement(m: typeof warehouseMovementsTable.$inferSelect) {
  return {
    id: m.id,
    tenantId: m.tenantId,
    fabricRollId: m.fabricRollId,
    fromWarehouseId: m.fromWarehouseId ?? null,
    toWarehouseId: m.toWarehouseId ?? null,
    movedById: m.movedById,
    reason: m.reason ?? null,
    movedAt: m.movedAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/warehouses", requireAuth, async (req, res): Promise<void> => {
  const warehouses = await db.select().from(warehousesTable)
    .where(eq(warehousesTable.tenantId, req.user!.tenantId))
    .orderBy(warehousesTable.name);
  res.json(ListWarehousesResponse.parse(warehouses.map(formatWarehouse)));
});

router.post("/warehouses", requireAuth, checkSubscription(), async (req, res): Promise<void> => {
  const parsed = CreateWarehouseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const usageCheck = await ensureUsageWithinLimit(req.user!.tenantId, "warehouses");
  if (!usageCheck.allowed) {
    res.status(403).json({
      error: "Warehouse limit reached for current subscription plan",
      current: usageCheck.current,
      limit: usageCheck.limit,
    });
    return;
  }

  const [warehouse] = await db.insert(warehousesTable).values({
    tenantId: req.user!.tenantId,
    name: parsed.data.name,
    location: parsed.data.location,
    capacity: parsed.data.capacity ?? null,
    isActive: true,
  }).returning();

  res.status(201).json(GetWarehouseResponse.parse(formatWarehouse(warehouse)));
});

router.get("/warehouses/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetWarehouseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [warehouse] = await db.select().from(warehousesTable).where(
    and(eq(warehousesTable.id, params.data.id), eq(warehousesTable.tenantId, req.user!.tenantId))
  );

  if (!warehouse) {
    res.status(404).json({ error: "Warehouse not found" });
    return;
  }

  res.json(GetWarehouseResponse.parse(formatWarehouse(warehouse)));
});

router.patch("/warehouses/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateWarehouseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateWarehouseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.location != null) updates.location = parsed.data.location;
  if (parsed.data.capacity != null) updates.capacity = parsed.data.capacity;
  if (parsed.data.isActive != null) updates.isActive = parsed.data.isActive;

  const [warehouse] = await db.update(warehousesTable).set(updates).where(
    and(eq(warehousesTable.id, params.data.id), eq(warehousesTable.tenantId, req.user!.tenantId))
  ).returning();

  if (!warehouse) {
    res.status(404).json({ error: "Warehouse not found" });
    return;
  }

  res.json(UpdateWarehouseResponse.parse(formatWarehouse(warehouse)));
});

router.get("/warehouse-movements", requireAuth, async (req, res): Promise<void> => {
  const params = ListWarehouseMovementsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [eq(warehouseMovementsTable.tenantId, req.user!.tenantId)];
  if (params.data.fabricRollId) conditions.push(eq(warehouseMovementsTable.fabricRollId, params.data.fabricRollId));
  if (params.data.warehouseId) conditions.push(eq(warehouseMovementsTable.toWarehouseId, params.data.warehouseId));

  const movements = await db.select().from(warehouseMovementsTable)
    .where(and(...conditions))
    .orderBy(desc(warehouseMovementsTable.createdAt))
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  res.json(ListWarehouseMovementsResponse.parse(movements.map(formatMovement)));
});

router.post("/warehouse-movements", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateWarehouseMovementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fabricRollId, fromWarehouseId, toWarehouseId, reason } = parsed.data;
  const [roll] = await db.select().from(fabricRollsTable).where(
    and(eq(fabricRollsTable.id, fabricRollId), eq(fabricRollsTable.tenantId, req.user!.tenantId))
  );

  if (!roll) {
    res.status(404).json({ error: "Fabric roll not found" });
    return;
  }

  if (fromWarehouseId) {
    const [fromWarehouse] = await db.select().from(warehousesTable).where(
      and(eq(warehousesTable.id, fromWarehouseId), eq(warehousesTable.tenantId, req.user!.tenantId))
    );

    if (!fromWarehouse) {
      res.status(404).json({ error: "Source warehouse not found" });
      return;
    }
  }

  const [toWarehouse] = await db.select().from(warehousesTable).where(
    and(eq(warehousesTable.id, toWarehouseId), eq(warehousesTable.tenantId, req.user!.tenantId))
  );

  if (!toWarehouse) {
    res.status(404).json({ error: "Destination warehouse not found" });
    return;
  }

  const [movement] = await db.insert(warehouseMovementsTable).values({
    tenantId: req.user!.tenantId,
    fabricRollId,
    fromWarehouseId: fromWarehouseId ?? null,
    toWarehouseId: toWarehouseId ?? null,
    movedById: req.user!.userId,
    reason: reason ?? null,
    movedAt: new Date(),
  }).returning();

  // Update roll warehouse
  await db.update(fabricRollsTable).set({
    warehouseId: toWarehouseId ?? null,
    status: "IN_STOCK",
  }).where(and(eq(fabricRollsTable.id, fabricRollId), eq(fabricRollsTable.tenantId, req.user!.tenantId)));

  await db.insert(auditLogsTable).values({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    entityType: "warehouse_movement",
    entityId: movement.id,
    action: "CREATE",
    changes: JSON.stringify({ fabricRollId, fromWarehouseId, toWarehouseId }),
  });

  res.status(201).json(formatMovement(movement));
});

export default router;
