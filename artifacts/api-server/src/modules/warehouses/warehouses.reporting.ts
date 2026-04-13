import { FABRIC_ROLL_WORKFLOW_STATUS } from "@workspace/api-zod";

export type InventoryStatusCount = {
  status: string;
  count: number;
};

export type WarehouseStockRow = {
  warehouseId: number;
  name: string;
  location: string;
  capacity: number | null;
  currentStock: number;
};

export function buildInventoryReport(input: {
  statusCounts: InventoryStatusCount[];
  warehouseStock: WarehouseStockRow[];
  lowStockThreshold: number;
  movementSummary?: {
    currentStock: number;
    availableForSale: number;
    reserved: number;
  };
}) {
  const countByStatus = new Map(input.statusCounts.map((row) => [row.status, row.count]));
  const getCount = (status: string) => countByStatus.get(status) ?? 0;

  const activeRolls = input.statusCounts
    .filter((row) => row.status !== FABRIC_ROLL_WORKFLOW_STATUS.sold)
    .reduce((total, row) => total + row.count, 0);
  const currentStock = input.movementSummary?.currentStock
    ?? (getCount(FABRIC_ROLL_WORKFLOW_STATUS.inStock) + getCount(FABRIC_ROLL_WORKFLOW_STATUS.reserved));
  const reservedCount = input.movementSummary?.reserved ?? getCount(FABRIC_ROLL_WORKFLOW_STATUS.reserved);
  const availableForSale = input.movementSummary?.availableForSale ?? getCount(FABRIC_ROLL_WORKFLOW_STATUS.inStock);

  return {
    totalRolls: input.statusCounts.reduce((total, row) => total + row.count, 0),
    activeRolls,
    currentStock,
    availableForSale,
    reserved: reservedCount,
    sold: getCount(FABRIC_ROLL_WORKFLOW_STATUS.sold),
    byStatus: input.statusCounts,
    readiness: {
      inProduction: getCount(FABRIC_ROLL_WORKFLOW_STATUS.inProduction),
      awaitingQc: getCount(FABRIC_ROLL_WORKFLOW_STATUS.qcPending),
      readyForDyeing: getCount(FABRIC_ROLL_WORKFLOW_STATUS.qcPassed),
      readyForWarehouse: getCount(FABRIC_ROLL_WORKFLOW_STATUS.qcPassed) + getCount(FABRIC_ROLL_WORKFLOW_STATUS.finished),
      availableForSale: getCount(FABRIC_ROLL_WORKFLOW_STATUS.inStock),
      blocked: getCount(FABRIC_ROLL_WORKFLOW_STATUS.qcFailed),
    },
    lowStockCandidates: input.warehouseStock
      .filter((warehouse) => warehouse.currentStock <= input.lowStockThreshold)
      .map((warehouse) => ({
        warehouseId: warehouse.warehouseId,
        name: warehouse.name,
        location: warehouse.location,
        currentStock: warehouse.currentStock,
        capacity: warehouse.capacity,
        threshold: input.lowStockThreshold,
      })),
    byWarehouse: input.warehouseStock,
  };
}
