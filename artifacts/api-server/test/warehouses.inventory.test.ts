import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveStockByWarehouse,
  inferInventoryOperation,
  InventoryStockError,
  validateInventoryOperation,
} from "../src/modules/warehouses/warehouses.inventory";

test("inventory operation inference supports inbound outbound and transfer", () => {
  assert.equal(inferInventoryOperation({ fromWarehouseId: null, toWarehouseId: 1 }), "inbound");
  assert.equal(inferInventoryOperation({ fromWarehouseId: 1, toWarehouseId: null }), "outbound");
  assert.equal(inferInventoryOperation({ fromWarehouseId: 1, toWarehouseId: 2 }), "transfer");
  assert.equal(inferInventoryOperation({ fromWarehouseId: 1, toWarehouseId: 1 }), "reserve");
});

test("stock derivation calculates current roll counts by warehouse", () => {
  const stock = deriveStockByWarehouse([
    { fabricRollId: 1, fromWarehouseId: null, toWarehouseId: 10, movedAt: "2026-01-01T00:00:00.000Z" },
    { fabricRollId: 2, fromWarehouseId: null, toWarehouseId: 10, movedAt: "2026-01-01T01:00:00.000Z" },
    { fabricRollId: 1, fromWarehouseId: 10, toWarehouseId: 20, movedAt: "2026-01-02T00:00:00.000Z" },
  ]);

  assert.equal(stock.stockByWarehouse.get(10), 1);
  assert.equal(stock.stockByWarehouse.get(20), 1);
  assert.equal(stock.rollLocations.get(1), 20);
  assert.equal(stock.rollLocations.get(2), 10);
});

test("stock derivation rejects duplicate inbound intake", () => {
  assert.throws(
    () => deriveStockByWarehouse([
      { fabricRollId: 1, fromWarehouseId: null, toWarehouseId: 10 },
      { fabricRollId: 1, fromWarehouseId: null, toWarehouseId: 20 },
    ]),
    InventoryStockError,
  );
});

test("stock derivation prevents negative outbound stock", () => {
  assert.throws(
    () => deriveStockByWarehouse([
      { fabricRollId: 1, fromWarehouseId: 10, toWarehouseId: null },
    ]),
    /not currently in warehouse/i,
  );
});

test("stock derivation rejects transfer from the wrong warehouse", () => {
  assert.throws(
    () => deriveStockByWarehouse([
      { fabricRollId: 1, fromWarehouseId: null, toWarehouseId: 10 },
      { fabricRollId: 1, fromWarehouseId: 20, toWarehouseId: 30 },
    ]),
    /source warehouse must match/i,
  );
});

test("reserve requires currently stocked inventory", () => {
  assert.doesNotThrow(() => {
    validateInventoryOperation({
      operation: "reserve",
      currentWarehouseId: 10,
    });
  });

  assert.throws(
    () => validateInventoryOperation({
      operation: "reserve",
      currentWarehouseId: null,
    }),
    /not currently in warehouse/i,
  );
});

test("stock derivation tracks reserved rolls without changing location", () => {
  const stock = deriveStockByWarehouse([
    { fabricRollId: 1, fromWarehouseId: null, toWarehouseId: 10, movedAt: "2026-01-01T00:00:00.000Z" },
    { fabricRollId: 1, fromWarehouseId: 10, toWarehouseId: 10, movedAt: "2026-01-01T01:00:00.000Z" },
  ]);

  assert.equal(stock.rollLocations.get(1), 10);
  assert.ok(stock.reservedRolls.has(1));
});

test("stock derivation rejects duplicate reserve movements", () => {
  assert.throws(
    () => deriveStockByWarehouse([
      { fabricRollId: 1, fromWarehouseId: null, toWarehouseId: 10 },
      { fabricRollId: 1, fromWarehouseId: 10, toWarehouseId: 10 },
      { fabricRollId: 1, fromWarehouseId: 10, toWarehouseId: 10 },
    ]),
    /reserve the same roll more than once/i,
  );
});
