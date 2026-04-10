import { formatWarehouse, type WarehousesServiceDependencies } from "./warehouses.types";

export function createWarehousesCrudUseCases(deps: WarehousesServiceDependencies) {
  const { warehousesRepository, ensureUsageWithinLimit } = deps;

  return {
    async listWarehouses(tenantId: number) {
      const warehouses = await warehousesRepository.listWarehouses(tenantId);
      return warehouses.map(formatWarehouse);
    },

    async createWarehouse(tenantId: number, data: {
      name: string;
      location: string;
      capacity?: number | null;
    }) {
      const usageCheck = await ensureUsageWithinLimit(tenantId, "warehouses");
      if (!usageCheck.allowed) {
        return {
          error: "Warehouse limit reached for current subscription plan" as const,
          current: usageCheck.current,
          limit: usageCheck.limit,
        };
      }

      const [warehouse] = await warehousesRepository.createWarehouse({
        tenantId,
        name: data.name,
        location: data.location,
        capacity: data.capacity ?? null,
        isActive: true,
      });

      return { data: formatWarehouse(warehouse) };
    },

    async getWarehouse(tenantId: number, id: number) {
      const [warehouse] = await warehousesRepository.findWarehouseById(tenantId, id);
      return warehouse ? formatWarehouse(warehouse) : null;
    },

    async updateWarehouse(tenantId: number, id: number, data: {
      name?: string;
      location?: string;
      capacity?: number | null;
      isActive?: boolean;
    }) {
      const updates: Record<string, unknown> = {};
      if (data.name != null) updates.name = data.name;
      if (data.location != null) updates.location = data.location;
      if (data.capacity != null) updates.capacity = data.capacity;
      if (data.isActive != null) updates.isActive = data.isActive;

      const [warehouse] = await warehousesRepository.updateWarehouse(tenantId, id, updates);
      return warehouse ? formatWarehouse(warehouse) : null;
    },
  };
}
