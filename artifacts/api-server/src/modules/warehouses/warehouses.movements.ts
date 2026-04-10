import { formatMovement, type WarehousesServiceDependencies } from "./warehouses.types";

export function createWarehouseMovementsUseCases(deps: WarehousesServiceDependencies) {
  const { warehousesRepository } = deps;

  return {
    async listWarehouseMovements(
      tenantId: number,
      params: { fabricRollId?: number; warehouseId?: number; limit?: number; offset?: number },
    ) {
      const movements = await warehousesRepository.listWarehouseMovements(tenantId, {
        fabricRollId: params.fabricRollId,
        warehouseId: params.warehouseId,
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
        changes: JSON.stringify({
          fabricRollId: data.fabricRollId,
          fromWarehouseId: data.fromWarehouseId,
          toWarehouseId: data.toWarehouseId,
        }),
      });

      return { data: formatMovement(movement) };
    },
  };
}
