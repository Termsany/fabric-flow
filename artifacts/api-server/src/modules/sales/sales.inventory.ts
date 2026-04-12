import { FABRIC_ROLL_WORKFLOW_STATUS } from "@workspace/api-zod";
import { InventoryStockError, validateInventoryOperation } from "../warehouses/warehouses.inventory";

export type SellableRoll = {
  id: number;
  status: string;
  warehouseId: number | null;
};

export function validateSellableRolls(requestedRollIds: number[], rolls: SellableRoll[]) {
  if (rolls.length !== requestedRollIds.length) {
    return { error: "One or more selected rolls do not belong to this tenant", status: 400 as const };
  }

  for (const roll of rolls) {
    if (roll.status !== FABRIC_ROLL_WORKFLOW_STATUS.inStock) {
      return { error: "Only in-stock fabric rolls can be allocated to sales", status: 400 as const };
    }

    try {
      validateInventoryOperation({
        operation: "reserve",
        currentWarehouseId: roll.warehouseId,
      });
    } catch (error) {
      if (error instanceof InventoryStockError) {
        return { error: "Selected roll does not have available warehouse stock", status: 400 as const };
      }

      throw error;
    }
  }

  return null;
}

export function buildSalesStockSources(rolls: SellableRoll[]) {
  return rolls.map((roll) => ({
    fabricRollId: roll.id,
    warehouseId: roll.warehouseId,
  }));
}

export function validateDeliverableRolls(requestedRollIds: number[], rolls: Pick<SellableRoll, "id" | "status">[]) {
  if (rolls.length !== requestedRollIds.length) {
    return { error: "One or more sales rolls are no longer available for this tenant", status: 400 as const };
  }

  const unreservedRoll = rolls.find((roll) => roll.status !== FABRIC_ROLL_WORKFLOW_STATUS.reserved);
  if (unreservedRoll) {
    return { error: "Only reserved fabric rolls can be marked as sold", status: 400 as const };
  }

  return null;
}
