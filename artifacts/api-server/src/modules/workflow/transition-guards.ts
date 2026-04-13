import {
  getAllowedDyeingOrderTransitions,
  getAllowedFabricRollTransitions,
  getAllowedProductionOrderTransitions,
  getAllowedSalesOrderTransitions,
  isDyeingOrderTransitionAllowed,
  isFabricRollTransitionAllowed,
  isProductionOrderTransitionAllowed,
  isSalesOrderTransitionAllowed,
} from "@workspace/api-zod";

export class WorkflowTransitionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "WorkflowTransitionError";
    this.status = status;
  }
}

export function assertFabricRollTransitionAllowed(current: string, next: string) {
  if (isFabricRollTransitionAllowed(current, next)) return;
  throw new WorkflowTransitionError(
    `Invalid fabric roll status transition from ${current} to ${next}`,
  );
}

export function assertProductionOrderTransitionAllowed(current: string, next: string) {
  if (isProductionOrderTransitionAllowed(current, next)) return;
  throw new WorkflowTransitionError(
    `Invalid production order status transition from ${current} to ${next}`,
  );
}

export function assertDyeingOrderTransitionAllowed(current: string, next: string) {
  if (isDyeingOrderTransitionAllowed(current, next)) return;
  throw new WorkflowTransitionError(
    `Invalid dyeing order status transition from ${current} to ${next}`,
  );
}

export function assertSalesOrderTransitionAllowed(current: string, next: string) {
  if (isSalesOrderTransitionAllowed(current, next)) return;
  throw new WorkflowTransitionError(
    `Invalid sales order status transition from ${current} to ${next}`,
  );
}

export function getAllowedTransitionsForEntity(entity: "fabric_roll" | "production_order" | "dyeing_order" | "sales_order", status: string) {
  switch (entity) {
    case "fabric_roll":
      return getAllowedFabricRollTransitions(status);
    case "production_order":
      return getAllowedProductionOrderTransitions(status);
    case "dyeing_order":
      return getAllowedDyeingOrderTransitions(status);
    case "sales_order":
      return getAllowedSalesOrderTransitions(status);
    default:
      return [];
  }
}
