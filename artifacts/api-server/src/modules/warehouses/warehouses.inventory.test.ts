import test from "node:test";
import assert from "node:assert/strict";
import { InventoryStockError, deriveStockByWarehouse } from "./warehouses.inventory";

test("deriveStockByWarehouse tracks reserve then outbound correctly", () => {
  const { stockByWarehouse, reservedRolls, rollLocations } = deriveStockByWarehouse([
    {
      fabricRollId: 101,
      fromWarehouseId: null,
      toWarehouseId: 10,
      movementType: "inbound",
      movedAt: "2026-02-01T10:00:00.000Z",
    },
    {
      fabricRollId: 101,
      fromWarehouseId: 10,
      toWarehouseId: 10,
      movementType: "reserve",
      movedAt: "2026-02-02T10:00:00.000Z",
    },
    {
      fabricRollId: 101,
      fromWarehouseId: 10,
      toWarehouseId: null,
      movementType: "outbound",
      movedAt: "2026-02-03T10:00:00.000Z",
    },
  ]);

  assert.equal(stockByWarehouse.get(10), undefined);
  assert.equal(reservedRolls.has(101), false);
  assert.equal(rollLocations.get(101), null);
});

test("deriveStockByWarehouse blocks outbound without inbound stock", () => {
  assert.throws(
    () =>
      deriveStockByWarehouse([
        {
          fabricRollId: 202,
          fromWarehouseId: 10,
          toWarehouseId: null,
          movementType: "outbound",
          movedAt: "2026-02-01T10:00:00.000Z",
        },
      ]),
    (error: unknown) =>
      error instanceof InventoryStockError
      && error.message === "Cannot move outbound stock that is not currently in warehouse",
  );
});

test("deriveStockByWarehouse prevents duplicate reserves", () => {
  assert.throws(
    () =>
      deriveStockByWarehouse([
        {
          fabricRollId: 303,
          fromWarehouseId: null,
          toWarehouseId: 12,
          movementType: "inbound",
          movedAt: "2026-02-01T10:00:00.000Z",
        },
        {
          fabricRollId: 303,
          fromWarehouseId: 12,
          toWarehouseId: 12,
          movementType: "reserve",
          movedAt: "2026-02-02T10:00:00.000Z",
        },
        {
          fabricRollId: 303,
          fromWarehouseId: 12,
          toWarehouseId: 12,
          movementType: "reserve",
          movedAt: "2026-02-03T10:00:00.000Z",
        },
      ]),
    (error: unknown) =>
      error instanceof InventoryStockError
      && error.message === "Cannot reserve the same roll more than once",
  );
});

test("adjustment inbound increases stock", () => {
  const { stockByWarehouse } = deriveStockByWarehouse([
    {
      fabricRollId: 404,
      fromWarehouseId: null,
      toWarehouseId: 8,
      movementType: "adjustment",
      movedAt: "2026-03-01T10:00:00.000Z",
    },
  ]);

  assert.equal(stockByWarehouse.get(8), 1);
});
