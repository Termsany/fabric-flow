import type { dyeingOrdersTable, fabricRollsTable } from "@workspace/db";
import { DYEING_WORKFLOW_STATUS, FABRIC_ROLL_WORKFLOW_STATUS } from "@workspace/api-zod";

type DyeingOrderRow = typeof dyeingOrdersTable.$inferSelect;
type FabricRollRow = typeof fabricRollsTable.$inferSelect;

export class DyeingWorkflowError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DyeingWorkflowError";
    this.status = status;
  }
}

export function assertRollsCanEnterDyeing(rollIds: number[], rolls: FabricRollRow[]): void {
  if (rollIds.length === 0) {
    throw new DyeingWorkflowError("At least one fabric roll is required for dyeing");
  }

  if (rolls.length !== rollIds.length) {
    throw new DyeingWorkflowError("One or more selected rolls do not belong to this tenant");
  }

  const ineligibleRoll = rolls.find((roll) => roll.status !== FABRIC_ROLL_WORKFLOW_STATUS.qcPassed);
  if (ineligibleRoll) {
    throw new DyeingWorkflowError("Only QC-passed fabric rolls can enter dyeing");
  }
}

export function assertDyeingTransitionAllowed(order: DyeingOrderRow, nextStatus: string): void {
  if (order.status === DYEING_WORKFLOW_STATUS.completed && nextStatus !== DYEING_WORKFLOW_STATUS.completed) {
    throw new DyeingWorkflowError("Completed dyeing orders cannot be reopened");
  }

  if (order.status === DYEING_WORKFLOW_STATUS.cancelled && nextStatus !== DYEING_WORKFLOW_STATUS.cancelled) {
    throw new DyeingWorkflowError("Cancelled dyeing orders cannot transition to another status");
  }

  if (nextStatus === DYEING_WORKFLOW_STATUS.completed && (!order.rollIds || order.rollIds.length === 0)) {
    throw new DyeingWorkflowError("Dyeing order cannot be completed without linked fabric rolls");
  }
}

export function buildDyeingWorkflowSummary(order: Pick<DyeingOrderRow, "status" | "rollIds">) {
  const rollCount = order.rollIds?.length ?? 0;

  if (order.status === DYEING_WORKFLOW_STATUS.completed) {
    return {
      currentState: "completed",
      linkedRollCount: rollCount,
      nextStep: {
        action: "Move finished rolls to warehouse",
        description: "Dyeing is complete. Linked rolls are ready for warehouse assignment.",
        route: "/warehouse",
      },
    };
  }

  if (order.status === DYEING_WORKFLOW_STATUS.cancelled) {
    return {
      currentState: "cancelled",
      linkedRollCount: rollCount,
      nextStep: {
        action: null,
        description: "This dyeing order was cancelled and should not move forward.",
        route: null,
      },
    };
  }

  return {
    currentState: "in_dyeing",
    linkedRollCount: rollCount,
    nextStep: {
      action: "Complete dyeing",
      description: "Mark this dyeing order completed once the dyehouse returns the linked rolls.",
      route: "/dyeing",
    },
  };
}

export function formatDyeingOrderResponse(order: DyeingOrderRow, linkedRolls: FabricRollRow[] = []) {
  return {
    id: order.id,
    tenantId: order.tenantId,
    orderNumber: order.orderNumber,
    dyehouseName: order.dyehouseName,
    targetColor: order.targetColor,
    targetShade: order.targetShade ?? null,
    status: order.status,
    sentAt: order.sentAt?.toISOString() ?? null,
    receivedAt: order.receivedAt?.toISOString() ?? null,
    notes: order.notes ?? null,
    rollIds: order.rollIds ?? [],
    linkedFabricRolls: linkedRolls.map((roll) => ({
      id: roll.id,
      rollCode: roll.rollCode,
      status: roll.status,
      color: roll.color,
    })),
    workflow: buildDyeingWorkflowSummary(order),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
