import { buildInventoryReport } from "./warehouses.reporting";
import type { WarehousesServiceDependencies } from "./warehouses.types";

export function createWarehouseReportingUseCases(deps: WarehousesServiceDependencies) {
  const { warehousesRepository } = deps;

  return {
    async getInventoryReport(tenantId: number, params: { lowStockThreshold?: number }) {
      const [statusCounts, warehouseStock] = await Promise.all([
        warehousesRepository.listInventoryStatusCounts(tenantId),
        warehousesRepository.listWarehouseStock(tenantId),
      ]);

      return buildInventoryReport({
        statusCounts,
        warehouseStock,
        lowStockThreshold: params.lowStockThreshold ?? 5,
      });
    },
  };
}
