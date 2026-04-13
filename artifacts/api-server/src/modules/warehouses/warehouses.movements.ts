import { formatMovement, type WarehousesServiceDependencies } from "./warehouses.types";
import { validateWarehouseMovementReadiness } from "./warehouses.workflow";
import { buildAuditChanges } from "../../utils/audit-log";
import { FABRIC_ROLL_WORKFLOW_STATUS } from "@workspace/api-zod";
import { assertFabricRollTransitionAllowed } from "../workflow/transition-guards";
import { resolveInventoryOperation, validateInventoryOperation, type InventoryOperation } from "./warehouses.inventory";

export function createWarehouseMovementsUseCases(deps: WarehousesServiceDependencies) {
  const { warehousesRepository } = deps;

  return {
    async listWarehouseMovements(
      tenantId: number,
      params: { fabricRollId?: number; warehouseId?: number; search?: string; limit?: number; offset?: number },
    ) {
      const movements = await warehousesRepository.listWarehouseMovements(tenantId, {
        fabricRollId: params.fabricRollId,
        warehouseId: params.warehouseId,
        search: params.search,
        limit: params.limit ?? 100,
        offset: params.offset ?? 0,
      });

      return movements.map(formatMovement);
    },

    async createWarehouseMovement(
      tenantId: number,
      userId: number,
      data: {
        fabricRollId: number;
        fromWarehouseId?: number;
        toWarehouseId?: number;
        fromWarehouseLocationId?: number;
        toWarehouseLocationId?: number;
        movementType?: InventoryOperation;
        reason?: string | null;
      },
    ) {
      const [roll] = await warehousesRepository.findFabricRollById(tenantId, data.fabricRollId);
      if (!roll) {
        return { error: "Fabric roll not found" as const, status: 404 as const };
      }

      const inferredOperation = resolveInventoryOperation({
        fromWarehouseId: data.fromWarehouseId ?? null,
        toWarehouseId: data.toWarehouseId ?? null,
        movementType: data.movementType ?? null,
      }) ?? "transfer";

      if (inferredOperation === "inbound") {
        const readinessError = validateWarehouseMovementReadiness(roll, data.fromWarehouseId);
        if (readinessError) {
          return readinessError;
        }
      }

      try {
        validateInventoryOperation({
          operation: data.movementType ?? inferredOperation,
          currentWarehouseId: roll.warehouseId ?? null,
          fromWarehouseId: data.fromWarehouseId ?? null,
          toWarehouseId: data.toWarehouseId ?? null,
        });
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Invalid inventory operation",
          status: 400 as const,
        };
      }

      try {
        if (inferredOperation === "inbound" || inferredOperation === "transfer" || inferredOperation === "adjustment") {
          assertFabricRollTransitionAllowed(roll.status, FABRIC_ROLL_WORKFLOW_STATUS.inStock);
        }
        if (inferredOperation === "reserve") {
          assertFabricRollTransitionAllowed(roll.status, FABRIC_ROLL_WORKFLOW_STATUS.reserved);
        }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Invalid fabric roll status transition",
          status: 400 as const,
        };
      }

      const fromWarehouseId = data.fromWarehouseId ?? (inferredOperation === "reserve" ? roll.warehouseId ?? null : null);
      const toWarehouseId = data.toWarehouseId ?? (inferredOperation === "reserve" ? roll.warehouseId ?? null : null);

      if (fromWarehouseId) {
        const [fromWarehouse] = await warehousesRepository.findWarehouseById(tenantId, fromWarehouseId);
        if (!fromWarehouse) {
          return { error: "Source warehouse not found" as const, status: 404 as const };
        }
      }

      if (toWarehouseId) {
        const [toWarehouse] = await warehousesRepository.findWarehouseById(tenantId, toWarehouseId);
        if (!toWarehouse) {
          return { error: "Destination warehouse not found" as const, status: 404 as const };
        }
      }

      const [movement] = await warehousesRepository.createWarehouseMovement({
        tenantId,
        fabricRollId: data.fabricRollId,
        fromWarehouseId: fromWarehouseId ?? null,
        toWarehouseId: toWarehouseId ?? null,
        fromWarehouseLocationId: data.fromWarehouseLocationId ?? null,
        toWarehouseLocationId: data.toWarehouseLocationId ?? null,
        movementType: data.movementType ?? inferredOperation,
        movedById: userId,
        reason: data.reason ?? null,
        movedAt: new Date(),
      });

      if (inferredOperation === "reserve") {
        await warehousesRepository.updateFabricRollWarehouse(
          tenantId,
          data.fabricRollId,
          roll.warehouseId ?? null,
          roll.warehouseLocationId ?? null,
          FABRIC_ROLL_WORKFLOW_STATUS.reserved,
        );
      } else if (inferredOperation === "outbound") {
        await warehousesRepository.updateFabricRollWarehouse(
          tenantId,
          data.fabricRollId,
          null,
          null,
        );
      } else {
        await warehousesRepository.updateFabricRollWarehouse(
          tenantId,
          data.fabricRollId,
          toWarehouseId ?? null,
          data.toWarehouseLocationId ?? null,
          FABRIC_ROLL_WORKFLOW_STATUS.inStock,
        );
      }
      await warehousesRepository.insertAuditLog({
        tenantId,
        userId,
        entityType: "warehouse_movement",
        entityId: movement.id,
        action: "CREATE",
        changes: buildAuditChanges({
          before: {
            fabricRollId: data.fabricRollId,
            warehouseId: roll.warehouseId ?? null,
            status: roll.status,
          },
          after: {
            fabricRollId: data.fabricRollId,
            warehouseId: inferredOperation === "outbound" ? null : (toWarehouseId ?? roll.warehouseId ?? null),
            status: inferredOperation === "reserve"
              ? FABRIC_ROLL_WORKFLOW_STATUS.reserved
              : inferredOperation === "outbound"
                ? roll.status
                : FABRIC_ROLL_WORKFLOW_STATUS.inStock,
          },
          context: {
            movementType: data.movementType ?? inferredOperation,
            fromWarehouseId: fromWarehouseId ?? null,
            toWarehouseId: toWarehouseId ?? null,
            fromWarehouseLocationId: data.fromWarehouseLocationId ?? null,
            toWarehouseLocationId: data.toWarehouseLocationId ?? null,
            reason: data.reason ?? null,
          },
        }),
      });

      return { data: formatMovement(movement) };
    },
  };
}
