import { getAllowedSalesOrderTransitions, SALES_WORKFLOW_STATUS } from "@workspace/api-zod";
import type { salesOrdersTable } from "@workspace/db";

type SalesOrderRow = typeof salesOrdersTable.$inferSelect;

export function buildSalesOrderWorkflowSummary(order: Pick<SalesOrderRow, "status">) {
  const allowedNextStatuses = getAllowedSalesOrderTransitions(order.status);

  if (order.status === SALES_WORKFLOW_STATUS.delivered) {
    return {
      currentState: "completed",
      nextStep: {
        action: null,
        description: "Sales order is completed and no further action is required.",
        route: null,
      },
      allowedNextStatuses,
    };
  }

  if (order.status === SALES_WORKFLOW_STATUS.cancelled) {
    return {
      currentState: "cancelled",
      nextStep: {
        action: null,
        description: "Sales order is cancelled and cannot progress further.",
        route: null,
      },
      allowedNextStatuses,
    };
  }

  if (order.status === SALES_WORKFLOW_STATUS.draft) {
    return {
      currentState: "draft",
      nextStep: {
        action: "Confirm order",
        description: "Confirm the sales order once customer details and rolls are final.",
        route: "/sales",
      },
      allowedNextStatuses,
    };
  }

  if (order.status === SALES_WORKFLOW_STATUS.confirmed) {
    return {
      currentState: "confirmed",
      nextStep: {
        action: "Finalize delivery",
        description: "Mark the sales order delivered when the rolls are handed off.",
        route: "/sales",
      },
      allowedNextStatuses,
    };
  }

  return {
    currentState: "invoicing",
    nextStep: {
      action: "Finalize delivery",
      description: "Complete invoicing and mark the order delivered when ready.",
      route: "/sales",
    },
    allowedNextStatuses,
  };
}
