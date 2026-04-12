export type InventoryOperation = "inbound" | "outbound" | "transfer" | "reserve";

export type InventoryMovementInput = {
  fabricRollId: number;
  fromWarehouseId: number | null;
  toWarehouseId: number | null;
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

  return "transfer";
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

  if (input.currentWarehouseId == null) {
    throw new InventoryStockError("Cannot reserve stock that is not currently in warehouse");
  }
}

export function deriveStockByWarehouse(movements: InventoryMovementInput[]) {
  const rollLocations = new Map<number, number | null>();

  for (const movement of [...movements].sort((a, b) => movementTime(a) - movementTime(b))) {
    const operation = inferInventoryOperation(movement);
    const currentWarehouseId = rollLocations.get(movement.fabricRollId) ?? null;

    validateInventoryOperation({
      operation,
      currentWarehouseId,
      fromWarehouseId: movement.fromWarehouseId,
      toWarehouseId: movement.toWarehouseId,
    });

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
  };
}
