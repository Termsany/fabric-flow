export type InventoryOperation = "inbound" | "outbound" | "transfer" | "reserve" | "adjustment";

export type InventoryMovementInput = {
  fabricRollId: number;
  fromWarehouseId: number | null;
  toWarehouseId: number | null;
  movementType?: InventoryOperation | null;
  movedAt?: Date | string;
  createdAt?: Date | string;
};

export class InventoryStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryStockError";
  }
}

function movementTime(value: InventoryMovementInput) {
  const timestamp = value.movedAt ?? value.createdAt;
  return timestamp ? new Date(timestamp).getTime() : 0;
}

export function inferInventoryOperation(movement: Pick<InventoryMovementInput, "fromWarehouseId" | "toWarehouseId">): InventoryOperation {
  if (movement.fromWarehouseId == null && movement.toWarehouseId != null) {
    return "inbound";
  }

  if (movement.fromWarehouseId != null && movement.toWarehouseId == null) {
    return "outbound";
  }

  if (
    movement.fromWarehouseId != null
    && movement.toWarehouseId != null
    && movement.fromWarehouseId === movement.toWarehouseId
  ) {
    return "reserve";
  }

  return "transfer";
}

export function resolveInventoryOperation(movement: Pick<InventoryMovementInput, "fromWarehouseId" | "toWarehouseId" | "movementType">) {
  if (movement.movementType === "reserve") {
    return "reserve";
  }

  if (movement.movementType === "adjustment") {
    if (movement.toWarehouseId != null) {
      return "inbound";
    }
    if (movement.fromWarehouseId != null) {
      return "outbound";
    }
    return null;
  }

  if (movement.movementType) {
    return movement.movementType;
  }

  return inferInventoryOperation(movement);
}

export function validateInventoryOperation(input: {
  operation: InventoryOperation;
  currentWarehouseId: number | null;
  fromWarehouseId?: number | null;
  toWarehouseId?: number | null;
}): void {
  if (input.operation === "inbound") {
    if (input.currentWarehouseId != null) {
      throw new InventoryStockError("Cannot receive inbound stock for a roll that is already in warehouse");
    }

    if (input.toWarehouseId == null) {
      throw new InventoryStockError("Inbound stock requires a destination warehouse");
    }

    return;
  }

  if (input.operation === "outbound") {
    if (input.currentWarehouseId == null) {
      throw new InventoryStockError("Cannot move outbound stock that is not currently in warehouse");
    }

    if (input.fromWarehouseId !== input.currentWarehouseId) {
      throw new InventoryStockError("Outbound source warehouse must match current stock location");
    }

    return;
  }

  if (input.operation === "transfer") {
    if (input.currentWarehouseId == null) {
      throw new InventoryStockError("Cannot transfer stock that is not currently in warehouse");
    }

    if (input.fromWarehouseId !== input.currentWarehouseId) {
      throw new InventoryStockError("Transfer source warehouse must match current stock location");
    }

    if (input.toWarehouseId == null) {
      throw new InventoryStockError("Transfer requires a destination warehouse");
    }

    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new InventoryStockError("Transfer source and destination warehouses must be different");
    }

    return;
  }

  if (input.operation === "reserve") {
    if (input.currentWarehouseId == null) {
      throw new InventoryStockError("Cannot reserve stock that is not currently in warehouse");
    }

    if (input.fromWarehouseId != null && input.fromWarehouseId !== input.currentWarehouseId) {
      throw new InventoryStockError("Reserve source warehouse must match current stock location");
    }

    if (input.toWarehouseId != null && input.toWarehouseId !== input.currentWarehouseId) {
      throw new InventoryStockError("Reserve destination warehouse must match current stock location");
    }

    return;
  }

  if (input.operation === "adjustment") {
    if (input.fromWarehouseId != null && input.toWarehouseId != null) {
      throw new InventoryStockError("Adjustment cannot include both source and destination warehouses");
    }

    if (input.fromWarehouseId == null && input.toWarehouseId == null) {
      throw new InventoryStockError("Adjustment requires a source or destination warehouse");
    }

    if (input.fromWarehouseId != null && input.currentWarehouseId == null) {
      throw new InventoryStockError("Adjustment outbound requires stock to be in warehouse");
    }

    return;
  }

  if (input.currentWarehouseId == null) {
    throw new InventoryStockError("Cannot reserve stock that is not currently in warehouse");
  }
}

export function deriveStockByWarehouse(movements: InventoryMovementInput[]) {
  const rollLocations = new Map<number, number | null>();
  const reservedRolls = new Set<number>();

  for (const movement of [...movements].sort((a, b) => movementTime(a) - movementTime(b))) {
    const operation = resolveInventoryOperation(movement) ?? inferInventoryOperation(movement);
    const currentWarehouseId = rollLocations.get(movement.fabricRollId) ?? null;

    validateInventoryOperation({
      operation,
      currentWarehouseId,
      fromWarehouseId: movement.fromWarehouseId,
      toWarehouseId: movement.toWarehouseId,
    });

    if (operation === "reserve") {
      if (reservedRolls.has(movement.fabricRollId)) {
        throw new InventoryStockError("Cannot reserve the same roll more than once");
      }
      reservedRolls.add(movement.fabricRollId);
      continue;
    }

    reservedRolls.delete(movement.fabricRollId);
    rollLocations.set(movement.fabricRollId, operation === "outbound" ? null : movement.toWarehouseId);
  }

  const stockByWarehouse = new Map<number, number>();
  for (const warehouseId of rollLocations.values()) {
    if (warehouseId == null) {
      continue;
    }

    stockByWarehouse.set(warehouseId, (stockByWarehouse.get(warehouseId) ?? 0) + 1);
  }

  return {
    rollLocations,
    stockByWarehouse,
    reservedRolls,
  };
}
