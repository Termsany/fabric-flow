import { Router } from "express";
import { db, productionOrdersTable, fabricRollsTable, auditLogsTable } from "@workspace/db";
import { FABRIC_ROLL_WORKFLOW_STATUS, PRODUCTION_ORDER_WORKFLOW_STATUS } from "@workspace/api-zod";
import { eq, and, desc, ilike, or, like } from "drizzle-orm";
import { requireAuth, requireTenantRole } from "../lib/auth";
import { formatValidationError } from "../lib/request-validation";
import {
  ListProductionOrdersQueryParams,
  ListProductionOrdersResponse,
  GetProductionOrderParams,
  GetProductionOrderResponse,
  UpdateProductionOrderParams,
  UpdateProductionOrderResponse,
} from "@workspace/api-zod";
import {
  parseCreateProductionOrderBody,
  parseUpdateProductionOrderBody,
} from "./operational-workflow.validation";
import {
  formatProductionOrderResponse,
  ProductionOrderFabricRollLinkError,
} from "./production-orders.workflow";
import { pickAuditFields, writeOperationalAuditLog } from "../utils/audit-log";
import { normalizeIdentifierSearch } from "../utils/identifiers";
import { assertProductionOrderTransitionAllowed, WorkflowTransitionError } from "../modules/workflow/transition-guards";
import { logger } from "../lib/logger";

const router = Router();

function formatOrder(o: typeof productionOrdersTable.$inferSelect) {
  return {
    id: o.id,
    tenantId: o.tenantId,
    orderNumber: o.orderNumber,
    batchId: o.batchId ?? null,
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

async function listProductionOrderRolls(tenantId: number, productionOrderId: number) {
  return db.select().from(fabricRollsTable).where(
    and(
      eq(fabricRollsTable.tenantId, tenantId),
      eq(fabricRollsTable.productionOrderId, productionOrderId),
    ),
  ).orderBy(fabricRollsTable.id);
}

async function formatLinkedOrderResponse(order: typeof productionOrdersTable.$inferSelect) {
  const rolls = await listProductionOrderRolls(order.tenantId, order.id);
  return formatProductionOrderResponse(order, rolls);
}

function respondFabricRollLinkError(res: { status: (code: number) => { json: (body: unknown) => unknown } }, error: unknown): boolean {
  if (error instanceof ProductionOrderFabricRollLinkError) {
    res.status(500).json({ error: error.message });
    return true;
  }

  return false;
}

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

export function mapProductionOrderCreateError(error: unknown): { status: number; message: string } | null {
  const err = error as { code?: string; message?: string };
  const code = err?.code;
  const message = err?.message?.toLowerCase() ?? "";

  if (code === "42703" || message.includes("batch_id")) {
    return {
      status: 500,
      message: "Database schema is out of date for production orders. Apply migrations and try again.",
    };
  }

  if (code === "23502") {
    return { status: 400, message: "Required production order fields are missing." };
  }

  if (code === "22P02") {
    return { status: 400, message: "Production order fields have invalid types." };
  }

  return null;
}

export function computeNextBatchId(lastBatchId: string | null, now: Date) {
  const year = now.getFullYear();
  const prefix = `BATCH-${year}-`;
  const lastId = lastBatchId ?? "";
  const lastSeq = lastId.startsWith(prefix) ? Number(lastId.slice(prefix.length)) : 0;
  const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  const padded = String(nextSeq).padStart(4, "0");
  return `${prefix}${padded}`;
}

async function generateNextBatchId() {
  const year = new Date().getFullYear();
  const prefix = `BATCH-${year}-`;
  const [latest] = await db
    .select({ batchId: productionOrdersTable.batchId })
    .from(productionOrdersTable)
    .where(like(productionOrdersTable.batchId, `${prefix}%`))
    .orderBy(desc(productionOrdersTable.batchId))
    .limit(1);

  return computeNextBatchId(latest?.batchId ?? null, new Date());
}

router.get("/production-orders", requireAuth, requireTenantRole(["production_user"]), async (req, res): Promise<void> => {
  const params = ListProductionOrdersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: formatValidationError(params.error) });
    return;
  }

  const conditions = [eq(productionOrdersTable.tenantId, req.user!.tenantId)];
  if (params.data.status) {
    conditions.push(eq(productionOrdersTable.status, params.data.status));
  }
  if (params.data.batchId) {
    conditions.push(ilike(productionOrdersTable.batchId, `%${params.data.batchId}%`));
  }
  const identifierSearch = normalizeIdentifierSearch(params.data.search);
  if (identifierSearch) {
    const searchConditions = [
      ilike(productionOrdersTable.orderNumber, identifierSearch.pattern),
      ilike(productionOrdersTable.batchId, identifierSearch.pattern),
    ];
    if (identifierSearch.numericId != null) {
      searchConditions.push(eq(productionOrdersTable.id, identifierSearch.numericId));
    }
    conditions.push(or(...searchConditions)!);
  }

  const orders = await db.select().from(productionOrdersTable)
    .where(and(...conditions))
    .orderBy(desc(productionOrdersTable.createdAt))
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  res.json(ListProductionOrdersResponse.parse(orders.map(formatOrder)));
});

router.post("/production-orders", requireAuth, requireTenantRole(["production_user"]), async (req, res): Promise<void> => {
  const parsed = parseCreateProductionOrderBody(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatValidationError(parsed.error) });
    return;
  }

  const { fabricType, gsm, width, rawColor, quantity, notes } = parsed.data;

  // Generate unique order number
  const orderNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const batchId = await generateNextBatchId();
      try {
        const { order, rolls } = await db.transaction(async (tx) => {
          const [order] = await tx.insert(productionOrdersTable).values({
            tenantId: req.user!.tenantId,
            orderNumber,
            batchId,
            fabricType,
            gsm,
            width,
            rawColor,
            quantity,
            status: PRODUCTION_ORDER_WORKFLOW_STATUS.inProgress,
            notes: notes ?? null,
            rollsGenerated: quantity,
          }).returning();

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
              status: FABRIC_ROLL_WORKFLOW_STATUS.inProduction,
              qrCode: rollCode,
              notes: null,
            };
          });

          const rolls = await tx.insert(fabricRollsTable).values(rollsToInsert).returning();
          const response = formatProductionOrderResponse(order, rolls);

          await tx.insert(auditLogsTable).values({
            tenantId: req.user!.tenantId,
            userId: req.user!.userId,
            entityType: "production_order",
            entityId: order.id,
            action: "CREATE",
            changes: JSON.stringify({
              orderNumber,
              quantity,
              fabricRollIds: response.fabricRollIds,
            }),
          });

          return { order, rolls };
        });

        res.status(201).json(GetProductionOrderResponse.parse(formatProductionOrderResponse(order, rolls)));
        return;
      } catch (error) {
        const code = (error as { code?: string; message?: string })?.code;
        const message = (error as { message?: string })?.message?.toLowerCase() ?? "";
        const isBatchConflict = code === "23505" && message.includes("batch");
        if (isBatchConflict) {
          continue;
        }
        throw error;
      }
    }
    res.status(500).json({ error: "Failed to generate a unique batch number. Please retry." });
    return;
  } catch (error) {
    const mapped = mapProductionOrderCreateError(error);
    if (mapped) {
      logger.error({ err: error, tenantId: req.user!.tenantId }, "Production order creation failed");
      res.status(mapped.status).json({ error: mapped.message });
      return;
    }
    if (respondFabricRollLinkError(res, error)) {
      return;
    }

    throw error;
  }
});

router.get("/production-orders/:id", requireAuth, requireTenantRole(["production_user"]), async (req, res): Promise<void> => {
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

  try {
    res.json(GetProductionOrderResponse.parse(await formatLinkedOrderResponse(order)));
  } catch (error) {
    if (respondFabricRollLinkError(res, error)) {
      return;
    }

    throw error;
  }
});

router.patch("/production-orders/:id", requireAuth, requireTenantRole(["production_user"]), async (req, res): Promise<void> => {
  const params = UpdateProductionOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = parseUpdateProductionOrderBody(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatValidationError(parsed.error) });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status != null) updates.status = parsed.data.status;
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;

  const [existing] = await db.select().from(productionOrdersTable).where(
    and(eq(productionOrdersTable.id, params.data.id), eq(productionOrdersTable.tenantId, req.user!.tenantId))
  );

  if (!existing) {
    res.status(404).json({ error: "Production order not found" });
    return;
  }

  if (parsed.data.status != null && parsed.data.status !== existing.status) {
    try {
      assertProductionOrderTransitionAllowed(existing.status, parsed.data.status);
    } catch (error) {
      if (respondWorkflowTransitionError(res, error)) {
        return;
      }

      throw error;
    }
  }

  const [order] = await db.update(productionOrdersTable).set(updates).where(
    and(eq(productionOrdersTable.id, params.data.id), eq(productionOrdersTable.tenantId, req.user!.tenantId))
  ).returning();

  await writeOperationalAuditLog({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    entityType: "production_order",
    entityId: order.id,
    action: parsed.data.status != null && parsed.data.status !== existing.status ? "STATUS_CHANGED" : "UPDATE",
    before: pickAuditFields(existing, ["status", "notes"]),
    after: pickAuditFields(order, ["status", "notes"]),
    context: {
      orderNumber: order.orderNumber,
      changedFields: Object.keys(updates),
    },
  });

  try {
    res.json(UpdateProductionOrderResponse.parse(await formatLinkedOrderResponse(order)));
  } catch (error) {
    if (respondFabricRollLinkError(res, error)) {
      return;
    }

    throw error;
  }
});

export default router;
