import type { fabricRollsTable, productionOrdersTable } from "@workspace/db";
import { FABRIC_ROLL_WORKFLOW_STATUS } from "@workspace/api-zod";

type ProductionOrderRow = typeof productionOrdersTable.$inferSelect;
type FabricRollRow = typeof fabricRollsTable.$inferSelect;

export class ProductionOrderFabricRollLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionOrderFabricRollLinkError";
  }
}

type ProductionOrderWorkflowSummary = {
  currentState:
    | "generating_rolls"
    | "production"
    | "quality_control"
    | "dyeing"
    | "warehouse"
    | "sales"
    | "completed"
    | "mixed";
  rollCountsByStatus: Record<string, number>;
  readiness: {
    totalRolls: number;
    readyForQc: number;
    readyForDyeing: number;
    readyForWarehouse: number;
    readyForSales: number;
    sold: number;
  };
  nextStep: {
    action: string | null;
    description: string | null;
    route: string | null;
  };
};

export function assertProductionOrderFabricRollLinks(
  order: ProductionOrderRow,
  rolls: FabricRollRow[],
): void {
  if (rolls.length === 0) {
    throw new ProductionOrderFabricRollLinkError("Production order must have at least one linked fabric roll");
  }

  if (rolls.length !== order.rollsGenerated) {
    throw new ProductionOrderFabricRollLinkError("Production order roll count does not match linked fabric rolls");
  }

  const invalidRoll = rolls.find((roll) => roll.productionOrderId !== order.id || roll.tenantId !== order.tenantId);
  if (invalidRoll) {
    throw new ProductionOrderFabricRollLinkError("Production order has an invalid fabric roll link");
  }
}

function countRollStatuses(rolls: FabricRollRow[]) {
  return rolls.reduce<Record<string, number>>((counts, roll) => {
    counts[roll.status] = (counts[roll.status] ?? 0) + 1;
    return counts;
  }, {});
}

export function buildProductionOrderWorkflowSummary(rolls: FabricRollRow[]): ProductionOrderWorkflowSummary {
  const rollCountsByStatus = countRollStatuses(rolls);
  const readiness = {
    totalRolls: rolls.length,
    readyForQc: rollCountsByStatus[FABRIC_ROLL_WORKFLOW_STATUS.qcPending] ?? 0,
    readyForDyeing: rollCountsByStatus[FABRIC_ROLL_WORKFLOW_STATUS.qcPassed] ?? 0,
    readyForWarehouse: rollCountsByStatus[FABRIC_ROLL_WORKFLOW_STATUS.finished] ?? 0,
    readyForSales: rollCountsByStatus[FABRIC_ROLL_WORKFLOW_STATUS.inStock] ?? 0,
    sold: rollCountsByStatus[FABRIC_ROLL_WORKFLOW_STATUS.sold] ?? 0,
  };

  if (rolls.length === 0) {
    return {
      currentState: "generating_rolls",
      rollCountsByStatus,
      readiness,
      nextStep: {
        action: "Generate fabric rolls",
        description: "This production order needs linked fabric rolls before workflow processing can continue.",
        route: "/production-orders",
      },
    };
  }

  if (readiness.sold === rolls.length) {
    return {
      currentState: "completed",
      rollCountsByStatus,
      readiness,
      nextStep: {
        action: null,
        description: "All linked fabric rolls have completed sales fulfillment.",
        route: null,
      },
    };
  }

  if (readiness.readyForSales > 0) {
    return {
      currentState: "sales",
      rollCountsByStatus,
      readiness,
      nextStep: {
        action: "Allocate finished rolls to sales",
        description: "One or more rolls are in stock and ready for customer allocation.",
        route: "/sales",
      },
    };
  }

  if (readiness.readyForWarehouse > 0) {
    return {
      currentState: "warehouse",
      rollCountsByStatus,
      readiness,
      nextStep: {
        action: "Move finished rolls into warehouse",
        description: "One or more finished rolls need warehouse assignment before sales.",
        route: "/warehouse",
      },
    };
  }

  if (readiness.readyForDyeing > 0) {
    return {
      currentState: "dyeing",
      rollCountsByStatus,
      readiness,
      nextStep: {
        action: "Create dyeing order",
        description: "One or more rolls passed QC and are ready for dyeing.",
        route: "/dyeing",
      },
    };
  }

  if (readiness.readyForQc > 0) {
    return {
      currentState: "quality_control",
      rollCountsByStatus,
      readiness,
      nextStep: {
        action: "Run quality control",
        description: "One or more rolls are ready for QC inspection.",
        route: "/quality-control",
      },
    };
  }

  if (rollCountsByStatus[FABRIC_ROLL_WORKFLOW_STATUS.inProduction]) {
    return {
      currentState: "production",
      rollCountsByStatus,
      readiness,
      nextStep: {
        action: "Continue production",
        description: "Rolls are still in production before QC intake.",
        route: "/production-orders",
      },
    };
  }

  return {
    currentState: "mixed",
    rollCountsByStatus,
    readiness,
    nextStep: {
      action: "Review linked rolls",
      description: "Linked rolls are split across workflow states and should be reviewed individually.",
      route: "/fabric-rolls",
    },
  };
}

export function formatProductionOrderResponse(
  order: ProductionOrderRow,
  rolls: FabricRollRow[],
) {
  assertProductionOrderFabricRollLinks(order, rolls);

  return {
    id: order.id,
    tenantId: order.tenantId,
    orderNumber: order.orderNumber,
    fabricType: order.fabricType,
    gsm: order.gsm,
    width: order.width,
    rawColor: order.rawColor,
    quantity: order.quantity,
    status: order.status,
    notes: order.notes ?? null,
    rollsGenerated: order.rollsGenerated,
    fabricRollIds: rolls.map((roll) => roll.id),
    linkedFabricRolls: rolls.map((roll) => ({
      id: roll.id,
      rollCode: roll.rollCode,
      status: roll.status,
      color: roll.color,
      length: roll.length,
      weight: roll.weight,
      warehouseId: roll.warehouseId ?? null,
    })),
    workflow: buildProductionOrderWorkflowSummary(rolls),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
