import test from "node:test";
import assert from "node:assert/strict";
import { createOperationalSearchService } from "./operational-search.service";

test("operational search prioritizes exact matches over prefix matches", async () => {
  const service = createOperationalSearchService({
    findMatches: async () => ({
      fabricRolls: [
        {
          id: 1,
          rollCode: "ROLL-100",
          batchId: "BATCH-9",
          status: "IN_STOCK",
          productionOrderId: 5,
        },
      ],
      productionOrders: [
        {
          id: 2,
          orderNumber: "PO-100",
          batchId: "BATCH-100",
          status: "IN_PROGRESS",
          fabricType: "Cotton",
        },
      ],
      salesOrders: [],
      warehouses: [],
    }),
  });

  const results = await service.search(1, "PO-100", { limit: 5 });
  assert.equal(results[0].type, "production_order");
  assert.equal(results[0].label, "PO-100");
});

test("operational search prioritizes prefix matches over contains matches", async () => {
  const service = createOperationalSearchService({
    findMatches: async () => ({
      fabricRolls: [
        {
          id: 1,
          rollCode: "ROLL-210",
          batchId: "BATCH-210",
          status: "IN_STOCK",
          productionOrderId: 5,
        },
        {
          id: 2,
          rollCode: "ROLL-100",
          batchId: "BATCH-100",
          status: "IN_STOCK",
          productionOrderId: 6,
        },
      ],
      productionOrders: [],
      salesOrders: [],
      warehouses: [],
    }),
  });

  const results = await service.search(1, "batch-1", { limit: 5 });
  assert.equal(results[0].label, "ROLL-100");
});

test("operational search returns empty array for empty query", async () => {
  const service = createOperationalSearchService({
    findMatches: async () => ({
      fabricRolls: [],
      productionOrders: [],
      salesOrders: [],
      warehouses: [],
    }),
  });

  const results = await service.search(1, "   ", { limit: 5 });
  assert.deepEqual(results, []);
});
