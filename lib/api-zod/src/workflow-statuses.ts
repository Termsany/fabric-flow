import { z } from "zod/v4";

export const PRODUCTION_ORDER_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const DYEING_ORDER_STATUSES = ["PENDING", "SENT", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const SALES_ORDER_STATUSES = ["DRAFT", "CONFIRMED", "INVOICED", "DELIVERED", "CANCELLED"] as const;
export const FABRIC_ROLL_STATUSES = [
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
] as const;
export const QC_RESULTS = ["PASS", "FAIL", "PENDING", "REWORK"] as const;
export const LEGACY_QC_RESULTS = ["SECOND"] as const;

export type ProductionOrderStatus = (typeof PRODUCTION_ORDER_STATUSES)[number];
export type DyeingOrderStatus = (typeof DYEING_ORDER_STATUSES)[number];
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];
export type FabricRollStatus = (typeof FABRIC_ROLL_STATUSES)[number];

export const productionOrderStatusSchema = z.enum(PRODUCTION_ORDER_STATUSES);
export const dyeingOrderStatusSchema = z.enum(DYEING_ORDER_STATUSES);
export const salesOrderStatusSchema = z.enum(SALES_ORDER_STATUSES);
export const fabricRollStatusSchema = z.enum(FABRIC_ROLL_STATUSES);
export const qcResultSchema = z.enum(QC_RESULTS);

export const WORKFLOW_DEFAULTS = {
  productionOrderStatus: "PENDING" as const,
  dyeingOrderStatus: "PENDING" as const,
  salesOrderStatus: "DRAFT" as const,
  fabricRollStatus: "CREATED" as const,
  qcResult: "PASS" as const,
};

export const FABRIC_ROLL_WORKFLOW_STATUS = {
  inProduction: "IN_PRODUCTION" as const,
  qcPending: "QC_PENDING" as const,
  qcPassed: "QC_PASSED" as const,
  qcFailed: "QC_FAILED" as const,
  sentToDyeing: "SENT_TO_DYEING" as const,
  inDyeing: "IN_DYEING" as const,
  finished: "FINISHED" as const,
  inStock: "IN_STOCK" as const,
  reserved: "RESERVED" as const,
  sold: "SOLD" as const,
};

export const PRODUCTION_ORDER_WORKFLOW_STATUS = {
  pending: "PENDING" as const,
  inProgress: "IN_PROGRESS" as const,
  completed: "COMPLETED" as const,
  cancelled: "CANCELLED" as const,
};

export const DYEING_WORKFLOW_STATUS = {
  pending: "PENDING" as const,
  sent: "SENT" as const,
  inProgress: "IN_PROGRESS" as const,
  completed: "COMPLETED" as const,
  cancelled: "CANCELLED" as const,
};

export const SALES_WORKFLOW_STATUS = {
  draft: "DRAFT" as const,
  confirmed: "CONFIRMED" as const,
  invoiced: "INVOICED" as const,
  delivered: "DELIVERED" as const,
  cancelled: "CANCELLED" as const,
};

export const FABRIC_ROLL_TRANSITIONS: Record<FabricRollStatus, FabricRollStatus[]> = {
  CREATED: ["IN_PRODUCTION"],
  IN_PRODUCTION: ["QC_PENDING"],
  QC_PENDING: ["QC_PASSED", "QC_FAILED"],
  QC_PASSED: ["QC_PENDING", "QC_FAILED", "SENT_TO_DYEING", "FINISHED", "IN_STOCK"],
  QC_FAILED: ["QC_PENDING", "QC_PASSED"],
  SENT_TO_DYEING: ["IN_DYEING", "FINISHED"],
  IN_DYEING: ["FINISHED"],
  FINISHED: ["IN_STOCK"],
  IN_STOCK: ["RESERVED"],
  RESERVED: ["SOLD"],
  SOLD: [],
};

export const PRODUCTION_ORDER_TRANSITIONS: Record<ProductionOrderStatus, ProductionOrderStatus[]> = {
  PENDING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const DYEING_ORDER_TRANSITIONS: Record<DyeingOrderStatus, DyeingOrderStatus[]> = {
  PENDING: ["SENT", "CANCELLED"],
  SENT: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const SALES_ORDER_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["INVOICED", "DELIVERED", "CANCELLED"],
  INVOICED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function getAllowedFabricRollTransitions(status: string): FabricRollStatus[] {
  return FABRIC_ROLL_TRANSITIONS[status as FabricRollStatus] ?? [];
}

export function getAllowedProductionOrderTransitions(status: string): ProductionOrderStatus[] {
  return PRODUCTION_ORDER_TRANSITIONS[status as ProductionOrderStatus] ?? [];
}

export function getAllowedDyeingOrderTransitions(status: string): DyeingOrderStatus[] {
  return DYEING_ORDER_TRANSITIONS[status as DyeingOrderStatus] ?? [];
}

export function getAllowedSalesOrderTransitions(status: string): SalesOrderStatus[] {
  return SALES_ORDER_TRANSITIONS[status as SalesOrderStatus] ?? [];
}

export function isFabricRollTransitionAllowed(current: string, next: string): boolean {
  if (current === next) return true;
  return getAllowedFabricRollTransitions(current).includes(next as FabricRollStatus);
}

export function isProductionOrderTransitionAllowed(current: string, next: string): boolean {
  if (current === next) return true;
  return getAllowedProductionOrderTransitions(current).includes(next as ProductionOrderStatus);
}

export function isDyeingOrderTransitionAllowed(current: string, next: string): boolean {
  if (current === next) return true;
  return getAllowedDyeingOrderTransitions(current).includes(next as DyeingOrderStatus);
}

export function isSalesOrderTransitionAllowed(current: string, next: string): boolean {
  if (current === next) return true;
  return getAllowedSalesOrderTransitions(current).includes(next as SalesOrderStatus);
}

export function normalizeQcResult(result: string) {
  const normalized = result.trim().toUpperCase();

  if (normalized === "PASSED") {
    return "PASS" as const;
  }

  if (normalized === "FAILED") {
    return "FAIL" as const;
  }

  if (normalized === "SECOND") {
    return "REWORK" as const;
  }

  return normalized as (typeof QC_RESULTS)[number];
}

export function getFabricRollStatusFromQcResult(result: string) {
  const normalized = normalizeQcResult(result);

  if (normalized === "PASS") {
    return FABRIC_ROLL_WORKFLOW_STATUS.qcPassed;
  }

  if (normalized === "FAIL") {
    return FABRIC_ROLL_WORKFLOW_STATUS.qcFailed;
  }

  return FABRIC_ROLL_WORKFLOW_STATUS.qcPending;
}
