import { formatMovement, type WarehousesServiceDependencies } from "./warehouses.types";
import { validateWarehouseMovementReadiness } from "./warehouses.workflow";
import { buildAuditChanges } from "../../utils/audit-log";
import { FABRIC_ROLL_WORKFLOW_STATUS } from "@workspace/api-zod";
import { assertFabricRollTransitionAllowed } from "../workflow/transition-guards";

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
        toWarehouseId: number;
        reason?: string | null;
      },
    ) {
      const [roll] = await warehousesRepository.findFabricRollById(tenantId, data.fabricRollId);
      if (!roll) {
        return { error: "Fabric roll not found" as const, status: 404 as const };
      }

      const readinessError = validateWarehouseMovementReadiness(roll, data.fromWarehouseId);
      if (readinessError) {
        return readinessError;
      }

      try {
        assertFabricRollTransitionAllowed(roll.status, FABRIC_ROLL_WORKFLOW_STATUS.inStock);
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Invalid fabric roll status transition",
          status: 400 as const,
        };
      }

      if (data.fromWarehouseId) {
        const [fromWarehouse] = await warehousesRepository.findWarehouseById(tenantId, data.fromWarehouseId);
        if (!fromWarehouse) {
          return { error: "Source warehouse not found" as const, status: 404 as const };
        }
      }

      const [toWarehouse] = await warehousesRepository.findWarehouseById(tenantId, data.toWarehouseId);
      if (!toWarehouse) {
        return { error: "Destination warehouse not found" as const, status: 404 as const };
      }

      const [movement] = await warehousesRepository.createWarehouseMovement({
        tenantId,
        fabricRollId: data.fabricRollId,
        fromWarehouseId: data.fromWarehouseId ?? null,
        toWarehouseId: data.toWarehouseId ?? null,
        movedById: userId,
        reason: data.reason ?? null,
        movedAt: new Date(),
      });

      await warehousesRepository.updateFabricRollWarehouse(tenantId, data.fabricRollId, data.toWarehouseId ?? null);
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
            warehouseId: data.toWarehouseId,
            status: FABRIC_ROLL_WORKFLOW_STATUS.inStock,
          },
          context: {
            movementType: movement.fromWarehouseId == null ? "inbound" : "transfer",
            fromWarehouseId: data.fromWarehouseId ?? null,
            toWarehouseId: data.toWarehouseId,
            reason: data.reason ?? null,
          },
        }),
      });

      return { data: formatMovement(movement) };
    },
  };
}
