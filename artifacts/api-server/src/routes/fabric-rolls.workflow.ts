import {
  FABRIC_ROLL_WORKFLOW_STATUS,
  getAllowedFabricRollTransitions,
} from "@workspace/api-zod";
type FabricRollStatus =
  | "CREATED"
  | "IN_PRODUCTION"
  | "QC_PENDING"
  | "QC_PASSED"
  | "QC_FAILED"
  | "SENT_TO_DYEING"
  | "IN_DYEING"
  | "FINISHED"
  | "IN_STOCK"
  | "RESERVED"
  | "SOLD";

export type FabricRollWorkflowSummary = {
  currentStatus: string;
  currentStage:
    | "production"
    | "quality_control"
    | "dyeing"
    | "warehouse"
    | "sales"
    | "completed"
    | "unknown";
  nextStep: {
    action: string | null;
    description: string | null;
    route: string | null;
  };
  allowedNextStatuses: string[];
};

export type FabricRollTraceability = {
  productionOrder: {
    id: number;
    orderNumber: string;
    status: string;
  } | null;
  currentWarehouse: {
    id: number;
    name: string;
    location: string;
  } | null;
  latestQc: {
    id: number;
    result: string;
    defectCount: number;
    inspectedAt: string;
    notes: string | null;
  } | null;
  latestMovement: {
    id: number;
    fromWarehouseId: number | null;
    toWarehouseId: number | null;
    movedAt: string;
    reason: string | null;
  } | null;
  latestDyeingOrder: {
    id: number;
    orderNumber: string;
    status: string;
    targetColor: string;
  } | null;
  latestSalesOrder: {
    id: number;
    orderNumber: string;
    status: string;
    customerId: number;
  } | null;
};

export type FabricRollTimelineEvent = {
  occurredAt: string;
  type:
    | "roll_created"
    | "production_order"
    | "qc_report"
    | "dyeing_order"
    | "warehouse_movement"
    | "sales_order"
    | "roll_status_change";
  title: string;
  description: string | null;
  status: string | null;
  entityType: string;
  entityId: number;
  metadata?: Record<string, unknown>;
};

function isFabricRollStatus(value: string): value is FabricRollStatus {
  return [
    "CREATED",
    "IN_PRODUCTION",
    "QC_PENDING",
    "QC_PASSED",
    "QC_FAILED",
    "SENT_TO_DYEING",
    "IN_DYEING",
    "FINISHED",
    "IN_STOCK",
    "RESERVED",
    "SOLD",
  ].includes(value);
}

export function buildFabricRollWorkflowSummary(status: string): FabricRollWorkflowSummary {
  const currentStatus = isFabricRollStatus(status) ? status : status || "UNKNOWN";
  const allowedNextStatuses = getAllowedFabricRollTransitions(currentStatus);

  switch (currentStatus) {
    case "CREATED":
    case FABRIC_ROLL_WORKFLOW_STATUS.inProduction:
      return {
        currentStatus,
        currentStage: "production",
        nextStep: {
          action: "Continue production",
          description: "Finish production and move the roll into QC intake.",
          route: "/production-orders",
        },
        allowedNextStatuses,
      };
    case FABRIC_ROLL_WORKFLOW_STATUS.qcPending:
      return {
        currentStatus,
        currentStage: "quality_control",
        nextStep: {
          action: "Run quality control",
          description: "Create a QC report so the next workflow path becomes explicit.",
          route: "/quality-control",
        },
        allowedNextStatuses,
      };
    case FABRIC_ROLL_WORKFLOW_STATUS.qcPassed:
      return {
        currentStatus,
        currentStage: "dyeing",
        nextStep: {
          action: "Send to dyeing",
          description: "The roll passed QC and is ready for dyeing planning.",
          route: "/dyeing",
        },
        allowedNextStatuses,
      };
    case FABRIC_ROLL_WORKFLOW_STATUS.qcFailed:
      return {
        currentStatus,
        currentStage: "quality_control",
        nextStep: {
          action: "Review QC failure",
          description: "Investigate defects before reprocessing or re-inspection.",
          route: "/quality-control",
        },
        allowedNextStatuses,
      };
    case FABRIC_ROLL_WORKFLOW_STATUS.sentToDyeing:
    case FABRIC_ROLL_WORKFLOW_STATUS.inDyeing:
      return {
        currentStatus,
        currentStage: "dyeing",
        nextStep: {
          action: "Track dyeing order",
          description: "Monitor dyeing progress and mark the roll received when completed.",
          route: "/dyeing",
        },
        allowedNextStatuses,
      };
    case FABRIC_ROLL_WORKFLOW_STATUS.finished:
      return {
        currentStatus,
        currentStage: "warehouse",
        nextStep: {
          action: "Move to warehouse",
          description: "Assign storage and mark the roll in stock before sales allocation.",
          route: "/warehouse",
        },
        allowedNextStatuses,
      };
    case FABRIC_ROLL_WORKFLOW_STATUS.inStock:
      return {
        currentStatus,
        currentStage: "sales",
        nextStep: {
          action: "Allocate to sales",
          description: "The roll is ready for customer reservation or sales order creation.",
          route: "/sales",
        },
        allowedNextStatuses,
      };
    case FABRIC_ROLL_WORKFLOW_STATUS.reserved:
      return {
        currentStatus,
        currentStage: "sales",
        nextStep: {
          action: "Finalize sale",
          description: "The roll is reserved and should move through sales fulfillment.",
          route: "/sales",
        },
        allowedNextStatuses,
      };
    case FABRIC_ROLL_WORKFLOW_STATUS.sold:
      return {
        currentStatus,
        currentStage: "completed",
        nextStep: {
          action: null,
          description: "The roll has completed the operational workflow.",
          route: null,
        },
        allowedNextStatuses,
      };
    default:
      return {
        currentStatus,
        currentStage: "unknown",
        nextStep: {
          action: null,
          description: "Review this roll manually before taking the next operational action.",
          route: null,
        },
        allowedNextStatuses,
      };
  }
}

export function buildFabricRollDetailResponse(base: {
  id: number;
  tenantId: number;
  rollCode: string;
  batchId: string;
  productionOrderId: number;
  warehouseId: number | null;
  warehouseLocationId: number | null;
  length: number;
  weight: number;
  color: string;
  gsm: number;
  width: number;
  fabricType: string;
  status: string;
  qrCode: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}, traceability: FabricRollTraceability, timeline: FabricRollTimelineEvent[] = []) {
  return {
    ...base,
    workflow: buildFabricRollWorkflowSummary(base.status),
    traceability,
    timeline,
  };
}

export function buildRollStatusChangeEvent(input: {
  occurredAt: string;
  entityId: number;
  beforeStatus?: string | null;
  afterStatus?: string | null;
  action?: string | null;
  context?: Record<string, unknown> | null;
}) {
  const beforeStatus = input.beforeStatus ?? null;
  const afterStatus = input.afterStatus ?? null;

  if (!beforeStatus && !afterStatus) {
    return null;
  }

  const description = beforeStatus && afterStatus
    ? `Status changed from ${beforeStatus} to ${afterStatus}.`
    : beforeStatus
      ? `Status changed from ${beforeStatus}.`
      : `Status updated to ${afterStatus}.`;

  return {
    occurredAt: input.occurredAt,
    type: "roll_status_change" as const,
    title: "Roll status updated",
    description,
    status: afterStatus ?? beforeStatus,
    entityType: "fabric_roll",
    entityId: input.entityId,
    metadata: {
      beforeStatus,
      afterStatus,
      action: input.action ?? null,
      context: input.context ?? {},
    },
  };
}

export function sortFabricRollTimeline(events: FabricRollTimelineEvent[]) {
  return [...events].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
}
