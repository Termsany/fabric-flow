import { Router } from "express";
import { db, dyeingOrdersTable, fabricRollsTable, auditLogsTable } from "@workspace/db";
import { DYEING_WORKFLOW_STATUS, FABRIC_ROLL_WORKFLOW_STATUS, WORKFLOW_DEFAULTS } from "@workspace/api-zod";
import { eq, and, desc, ilike, inArray, or } from "drizzle-orm";
import { requireAuth, requireTenantRole } from "../lib/auth";
import { checkPlanAccess } from "../lib/billing";
import { formatValidationError } from "../lib/request-validation";
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
import {
  assertDyeingTransitionAllowed,
  assertRollsCanEnterDyeing,
  DyeingWorkflowError,
  formatDyeingOrderResponse,
} from "./dyeing-orders.workflow";
import { buildAuditChanges, pickAuditFields } from "../utils/audit-log";
import { normalizeIdentifierSearch } from "../utils/identifiers";
import { assertFabricRollTransitionAllowed, WorkflowTransitionError } from "../modules/workflow/transition-guards";

const router = Router();

async function listLinkedDyeingRolls(tenantId: number, rollIds: number[]) {
  if (rollIds.length === 0) {
    return [];
  }

  return db.select().from(fabricRollsTable).where(
    and(inArray(fabricRollsTable.id, rollIds), eq(fabricRollsTable.tenantId, tenantId)),
  ).orderBy(fabricRollsTable.id);
}

async function formatDetailedDyeingOrder(order: typeof dyeingOrdersTable.$inferSelect) {
  const linkedRolls = await listLinkedDyeingRolls(order.tenantId, order.rollIds ?? []);
  return formatDyeingOrderResponse(order, linkedRolls);
}

function respondDyeingWorkflowError(
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  error: unknown,
): boolean {
  if (error instanceof DyeingWorkflowError) {
    res.status(error.status).json({ error: error.message });
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

router.get("/dyeing-orders", requireAuth, requireTenantRole(["dyeing_user"]), checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = ListDyeingOrdersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: formatValidationError(params.error) });
    return;
  }

  const conditions = [eq(dyeingOrdersTable.tenantId, req.user!.tenantId)];
  if (params.data.status) conditions.push(eq(dyeingOrdersTable.status, params.data.status));
  const identifierSearch = normalizeIdentifierSearch(params.data.search);
  if (identifierSearch) {
    const searchConditions = [
      ilike(dyeingOrdersTable.orderNumber, identifierSearch.pattern),
      ilike(dyeingOrdersTable.dyehouseName, identifierSearch.pattern),
      ilike(dyeingOrdersTable.targetColor, identifierSearch.pattern),
    ];
    if (identifierSearch.numericId != null) {
      searchConditions.push(eq(dyeingOrdersTable.id, identifierSearch.numericId));
    }
    conditions.push(or(...searchConditions)!);
  }

  const orders = await db.select().from(dyeingOrdersTable)
    .where(and(...conditions))
    .orderBy(desc(dyeingOrdersTable.createdAt))
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  res.json(ListDyeingOrdersResponse.parse(orders.map((order) => formatDyeingOrderResponse(order))));
});

router.post("/dyeing-orders", requireAuth, requireTenantRole(["dyeing_user"]), checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const parsed = CreateDyeingOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatValidationError(parsed.error) });
    return;
  }

  const { dyehouseName, targetColor, targetShade, rollIds, notes } = parsed.data;
  const orderNumber = `DYE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const selectedRollIds = rollIds ?? [];

  try {
    const { order, linkedRolls } = await db.transaction(async (tx) => {
      const tenantRolls = selectedRollIds.length === 0
        ? []
        : await tx.select().from(fabricRollsTable).where(
          and(inArray(fabricRollsTable.id, selectedRollIds), eq(fabricRollsTable.tenantId, req.user!.tenantId)),
        ).orderBy(fabricRollsTable.id);

      assertRollsCanEnterDyeing(selectedRollIds, tenantRolls);

      const [order] = await tx.insert(dyeingOrdersTable).values({
        tenantId: req.user!.tenantId,
        orderNumber,
        dyehouseName,
        targetColor,
        targetShade: targetShade ?? null,
        status: WORKFLOW_DEFAULTS.dyeingOrderStatus,
        rollIds: selectedRollIds,
        notes: notes ?? null,
        sentAt: null,
        receivedAt: null,
      }).returning();

      await tx.update(fabricRollsTable).set({ status: FABRIC_ROLL_WORKFLOW_STATUS.sentToDyeing })
        .where(and(inArray(fabricRollsTable.id, selectedRollIds), eq(fabricRollsTable.tenantId, req.user!.tenantId)));

      const linkedRolls = tenantRolls.map((roll) => ({
        ...roll,
        status: FABRIC_ROLL_WORKFLOW_STATUS.sentToDyeing,
      }));

      await tx.insert(auditLogsTable).values({
        tenantId: req.user!.tenantId,
        userId: req.user!.userId,
        entityType: "dyeing_order",
        entityId: order.id,
        action: "CREATE",
        changes: JSON.stringify({ orderNumber, rollCount: selectedRollIds.length }),
      });

      return { order, linkedRolls };
    });

    res.status(201).json(GetDyeingOrderResponse.parse(formatDyeingOrderResponse(order, linkedRolls)));
  } catch (error) {
    if (respondDyeingWorkflowError(res, error)) {
      return;
    }

    throw error;
  }
});

router.get("/dyeing-orders/:id", requireAuth, requireTenantRole(["dyeing_user"]), checkPlanAccess("pro"), async (req, res): Promise<void> => {
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

  res.json(GetDyeingOrderResponse.parse(await formatDetailedDyeingOrder(order)));
});

router.patch("/dyeing-orders/:id", requireAuth, requireTenantRole(["dyeing_user"]), checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = UpdateDyeingOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateDyeingOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatValidationError(parsed.error) });
    return;
  }

  try {
    const order = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(dyeingOrdersTable).where(
        and(eq(dyeingOrdersTable.id, params.data.id), eq(dyeingOrdersTable.tenantId, req.user!.tenantId)),
      );

      if (!existing) {
        return null;
      }

      if (parsed.data.status != null) {
        assertDyeingTransitionAllowed(existing, parsed.data.status);
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.status != null) updates.status = parsed.data.status;
      if (parsed.data.targetShade != null) updates.targetShade = parsed.data.targetShade;
      if (parsed.data.receivedAt != null) updates.receivedAt = new Date(parsed.data.receivedAt);
      if (parsed.data.notes != null) updates.notes = parsed.data.notes;
      if (parsed.data.status === DYEING_WORKFLOW_STATUS.completed && parsed.data.receivedAt == null) {
        updates.receivedAt = new Date();
      }

      const [order] = await tx.update(dyeingOrdersTable).set(updates).where(
        and(eq(dyeingOrdersTable.id, params.data.id), eq(dyeingOrdersTable.tenantId, req.user!.tenantId))
      ).returning();

      if (parsed.data.status === DYEING_WORKFLOW_STATUS.completed && order.rollIds && order.rollIds.length > 0) {
        const linkedRolls = await tx.select().from(fabricRollsTable).where(
          and(inArray(fabricRollsTable.id, order.rollIds), eq(fabricRollsTable.tenantId, req.user!.tenantId)),
        );

        if (linkedRolls.length !== order.rollIds.length) {
          throw new DyeingWorkflowError("One or more linked fabric rolls are missing for dyeing completion");
        }

        for (const roll of linkedRolls) {
          assertFabricRollTransitionAllowed(roll.status, FABRIC_ROLL_WORKFLOW_STATUS.finished);
        }

        await tx.update(fabricRollsTable).set({ status: FABRIC_ROLL_WORKFLOW_STATUS.finished })
          .where(and(inArray(fabricRollsTable.id, order.rollIds), eq(fabricRollsTable.tenantId, req.user!.tenantId)));
      }

      await tx.insert(auditLogsTable).values({
        tenantId: req.user!.tenantId,
        userId: req.user!.userId,
        entityType: "dyeing_order",
        entityId: order.id,
        action: parsed.data.status != null && parsed.data.status !== existing.status ? "DYEING_STATUS_CHANGED" : "UPDATE",
        changes: buildAuditChanges({
          before: pickAuditFields(existing, ["status", "targetShade", "receivedAt", "notes"]),
          after: pickAuditFields(order, ["status", "targetShade", "receivedAt", "notes"]),
          context: {
            orderNumber: order.orderNumber,
            rollIds: order.rollIds ?? [],
            affectedRollStatus: parsed.data.status === DYEING_WORKFLOW_STATUS.completed
              ? FABRIC_ROLL_WORKFLOW_STATUS.finished
              : null,
          },
        }),
      });

      return order;
    });

    if (!order) {
      res.status(404).json({ error: "Dyeing order not found" });
      return;
    }

    res.json(UpdateDyeingOrderResponse.parse(await formatDetailedDyeingOrder(order)));
  } catch (error) {
    if (respondDyeingWorkflowError(res, error)) {
      return;
    }
    if (respondWorkflowTransitionError(res, error)) {
      return;
    }

    throw error;
  }
});

export default router;
