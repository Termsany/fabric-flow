import { FABRIC_ROLL_WORKFLOW_STATUS } from "@workspace/api-zod";
import type { FabricRollRow } from "./warehouses.repository";

const WAREHOUSE_INTAKE_READY_STATUSES = [
  FABRIC_ROLL_WORKFLOW_STATUS.qcPassed,
  FABRIC_ROLL_WORKFLOW_STATUS.finished,
] as const;

export function isWarehouseIntakeReady(status: string): boolean {
  return (WAREHOUSE_INTAKE_READY_STATUSES as readonly string[]).includes(status);
}

export function validateWarehouseMovementReadiness(
  roll: Pick<FabricRollRow, "status" | "warehouseId">,
  fromWarehouseId?: number,
) {
  if (roll.warehouseId != null) {
    if (fromWarehouseId == null) {
      return { error: "Fabric roll is already in warehouse; provide fromWarehouseId for warehouse transfer", status: 400 as const };
    }

    if (fromWarehouseId !== roll.warehouseId) {
      return { error: "fromWarehouseId must match the fabric roll current warehouse", status: 400 as const };
    }

    if (roll.status !== FABRIC_ROLL_WORKFLOW_STATUS.inStock) {
      return { error: "Only in-stock fabric rolls can be transferred between warehouses", status: 400 as const };
    }

    return null;
  }

  if (fromWarehouseId != null) {
    return { error: "fromWarehouseId is not allowed for first warehouse intake", status: 400 as const };
  }

  if (!isWarehouseIntakeReady(roll.status)) {
    return { error: "Fabric roll must pass QC or complete dyeing before warehouse intake", status: 400 as const };
  }

  return null;
}
