import { buildInventoryReport } from "./warehouses.reporting";
import { deriveStockByWarehouse } from "./warehouses.inventory";
import type { WarehousesServiceDependencies } from "./warehouses.types";

export function createWarehouseReportingUseCases(deps: WarehousesServiceDependencies) {
  const { warehousesRepository } = deps;

  return {
    async getInventoryReport(tenantId: number, params: { lowStockThreshold?: number }) {
      const [statusCounts, warehouseStock, movements] = await Promise.all([
        warehousesRepository.listInventoryStatusCounts(tenantId),
        warehousesRepository.listWarehouseStock(tenantId),
        warehousesRepository.listWarehouseMovementsForTenant(tenantId),
      ]);

      try {
        const { stockByWarehouse, rollLocations, reservedRolls } = deriveStockByWarehouse(movements);
        const reservedByWarehouse = new Map<number, number>();
        for (const rollId of reservedRolls) {
          const warehouseId = rollLocations.get(rollId) ?? null;
          if (warehouseId == null) {
            continue;
          }

          reservedByWarehouse.set(warehouseId, (reservedByWarehouse.get(warehouseId) ?? 0) + 1);
        }

        const movementStock = warehouseStock.map((warehouse) => ({
          ...warehouse,
          currentStock: stockByWarehouse.get(warehouse.warehouseId) ?? 0,
        }));
        const currentStock = Array.from(stockByWarehouse.values()).reduce((total, count) => total + count, 0);
        const reservedCount = reservedRolls.size;

        return buildInventoryReport({
          statusCounts,
          warehouseStock: movementStock,
          lowStockThreshold: params.lowStockThreshold ?? 5,
          movementSummary: {
            currentStock,
            reserved: reservedCount,
            availableForSale: Math.max(currentStock - reservedCount, 0),
          },
        });
      } catch {
        return buildInventoryReport({
          statusCounts,
          warehouseStock,
          lowStockThreshold: params.lowStockThreshold ?? 5,
        });
      }
    },
  };
}
