import { ensureUsageWithinLimit } from "../../lib/billing";
import { warehousesRepository } from "./warehouses.repository";
import { createWarehousesCrudUseCases } from "./warehouses.crud";
import { createWarehouseMovementsUseCases } from "./warehouses.movements";
import { createWarehouseReportingUseCases } from "./warehouses.reports";
import type { WarehousesServiceDependencies } from "./warehouses.types";

export type { WarehousesServiceDependencies } from "./warehouses.types";

export function createWarehousesService(
  deps: WarehousesServiceDependencies = { warehousesRepository, ensureUsageWithinLimit },
) {
  return {
    ...createWarehousesCrudUseCases(deps),
    ...createWarehouseMovementsUseCases(deps),
    ...createWarehouseReportingUseCases(deps),
  };
}

export const warehousesService = createWarehousesService();
