import test from "node:test";
import assert from "node:assert/strict";
import { createOperationalSearchService } from "../src/modules/search/operational-search.service";

test("operational search returns normalized results across workflow records", async () => {
  const service = createOperationalSearchService({
    findMatches: async (tenantId, query, limitPerType) => {
      assert.equal(tenantId, 4);
      assert.equal(query, "1001");
      assert.equal(limitPerType, 5);

      return {
        fabricRolls: [{
          id: 1001,
          rollCode: "PO-1-R001",
          batchId: "BATCH-1",
          status: "IN_STOCK",
          productionOrderId: 77,
        }],
        productionOrders: [{
          id: 77,
          orderNumber: "PO-1",
          status: "IN_PROGRESS",
          fabricType: "Cotton",
        }],
        salesOrders: [{
          id: 90,
          orderNumber: "SO-1",
          invoiceNumber: "INV-1",
          status: "DELIVERED",
          customerId: 12,
        }],
        warehouses: [{
          id: 3,
          name: "Main Warehouse",
          location: "A1",
          isActive: true,
        }],
      };
    },
  });

  const results = await service.search(4, " 1001 ");

  assert.deepEqual(results.map((result) => result.type), [
    "fabric_roll",
    "production_order",
    "sales_order",
    "warehouse",
  ]);
  assert.equal(results[0]?.label, "PO-1-R001");
  assert.equal(results[0]?.href, "/fabric-rolls/1001");
  assert.equal(results[1]?.href, "/production-orders/77");
  assert.equal(results[2]?.href, "/sales");
  assert.equal(results[3]?.href, "/warehouses");
});

test("operational search returns no results for empty or unmatched queries", async () => {
  const service = createOperationalSearchService({
    findMatches: async () => ({
      fabricRolls: [],
      productionOrders: [],
      salesOrders: [],
      warehouses: [],
    }),
  });

  assert.deepEqual(await service.search(4, "   "), []);
  assert.deepEqual(await service.search(4, "missing"), []);
});
