import {
  db,
  fabricRollsTable,
  productionOrdersTable,
  salesOrdersTable,
  warehousesTable,
} from "@workspace/db";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { normalizeIdentifierSearch } from "../../utils/identifiers";

export type OperationalSearchResult = {
  type: "fabric_roll" | "production_order" | "sales_order" | "warehouse";
  id: number;
  label: string;
  subtitle: string | null;
  href: string;
  metadata: Record<string, unknown>;
};

type SearchRows = {
  fabricRolls: Array<{
    id: number;
    rollCode: string;
    batchId: string;
    status: string;
    productionOrderId: number;
  }>;
  productionOrders: Array<{
    id: number;
    orderNumber: string;
    batchId: string | null;
    status: string;
    fabricType: string;
  }>;
  salesOrders: Array<{
    id: number;
    orderNumber: string;
    invoiceNumber: string | null;
    status: string;
    customerId: number;
  }>;
  warehouses: Array<{
    id: number;
    name: string;
    location: string;
    isActive: boolean;
  }>;
};

export type OperationalSearchDependencies = {
  findMatches: (tenantId: number, query: string, limitPerType: number) => Promise<SearchRows>;
};

type MatchScore = {
  score: number;
  label: string;
};

function normalizeForMatch(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function scoreValueMatch(value: string, query: string): number {
  if (!value) return 3;
  if (value === query) return 0;
  if (value.startsWith(query)) return 1;
  if (value.includes(query)) return 2;
  return 3;
}

function pickBestScore(values: Array<string | null | undefined>, query: string): MatchScore {
  const normalizedQuery = normalizeForMatch(query);
  let best = 3;
  let label = "";

  for (const value of values) {
    const normalized = normalizeForMatch(value);
    const score = scoreValueMatch(normalized, normalizedQuery);
    if (score < best) {
      best = score;
      label = normalized;
    }
  }

  return { score: best, label };
}

export function rankOperationalResults(results: OperationalSearchResult[], query: string) {
  const scored = results.map((result) => {
    const values = [
      result.label,
      result.subtitle ?? "",
      String(result.metadata?.batchId ?? ""),
      String(result.metadata?.invoiceNumber ?? ""),
    ];
    const match = pickBestScore(values, query);
    return { result, score: match.score, label: match.label };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.label.localeCompare(b.label);
  });

  return scored.map((item) => item.result);
}

export function createOperationalSearchService(deps: OperationalSearchDependencies) {
  return {
    async search(tenantId: number, rawQuery: string, options: { limit?: number } = {}) {
      const normalized = normalizeIdentifierSearch(rawQuery);
      if (!normalized) {
        return [];
      }

      const limitPerType = Math.min(Math.max(options.limit ?? 5, 1), 10);
      const rows = await deps.findMatches(tenantId, normalized.text, limitPerType);

      const results = [
        ...rows.fabricRolls.map<OperationalSearchResult>((roll) => ({
          type: "fabric_roll",
          id: roll.id,
          label: roll.rollCode,
          subtitle: `Batch ${roll.batchId} · ${roll.status}`,
          href: `/fabric-rolls/${roll.id}`,
          metadata: {
            batchId: roll.batchId,
            status: roll.status,
            productionOrderId: roll.productionOrderId,
          },
        })),
        ...rows.productionOrders.map<OperationalSearchResult>((order) => ({
          type: "production_order",
          id: order.id,
          label: order.orderNumber,
          subtitle: `${order.batchId ? `Batch ${order.batchId}` : order.fabricType} · ${order.status}`,
          href: `/production-orders/${order.id}`,
          metadata: {
            status: order.status,
            fabricType: order.fabricType,
            batchId: order.batchId,
          },
        })),
        ...rows.salesOrders.map<OperationalSearchResult>((order) => ({
          type: "sales_order",
          id: order.id,
          label: order.orderNumber,
          subtitle: `${order.invoiceNumber ?? "No invoice"} · ${order.status}`,
          href: "/sales",
          metadata: {
            status: order.status,
            invoiceNumber: order.invoiceNumber,
            customerId: order.customerId,
          },
        })),
        ...rows.warehouses.map<OperationalSearchResult>((warehouse) => ({
          type: "warehouse",
          id: warehouse.id,
          label: warehouse.name,
          subtitle: warehouse.location,
          href: "/warehouses",
          metadata: {
            location: warehouse.location,
            isActive: warehouse.isActive,
          },
        })),
      ];

      return rankOperationalResults(results, normalized.text);
    },
  };
}

export const operationalSearchService = createOperationalSearchService({
  async findMatches(tenantId, rawQuery, limitPerType) {
    const query = normalizeIdentifierSearch(rawQuery);
    if (!query) {
      return { fabricRolls: [], productionOrders: [], salesOrders: [], warehouses: [] };
    }

    const fabricRollConditions = [
      ilike(fabricRollsTable.rollCode, query.pattern),
      ilike(fabricRollsTable.batchId, query.pattern),
      ilike(fabricRollsTable.qrCode, query.pattern),
    ];
    const productionOrderConditions = [
      ilike(productionOrdersTable.orderNumber, query.pattern),
      ilike(productionOrdersTable.batchId, query.pattern),
    ];
    const salesOrderConditions = [
      ilike(salesOrdersTable.orderNumber, query.pattern),
      ilike(salesOrdersTable.invoiceNumber, query.pattern),
    ];
    const warehouseConditions = [
      ilike(warehousesTable.name, query.pattern),
      ilike(warehousesTable.location, query.pattern),
    ];

    if (query.numericId != null) {
      fabricRollConditions.push(eq(fabricRollsTable.id, query.numericId));
      fabricRollConditions.push(eq(fabricRollsTable.productionOrderId, query.numericId));
      productionOrderConditions.push(eq(productionOrdersTable.id, query.numericId));
      salesOrderConditions.push(eq(salesOrdersTable.id, query.numericId));
      salesOrderConditions.push(eq(salesOrdersTable.customerId, query.numericId));
      warehouseConditions.push(eq(warehousesTable.id, query.numericId));
    }

    const [fabricRolls, productionOrders, salesOrders, warehouses] = await Promise.all([
      db.select({
        id: fabricRollsTable.id,
        rollCode: fabricRollsTable.rollCode,
        batchId: fabricRollsTable.batchId,
        status: fabricRollsTable.status,
        productionOrderId: fabricRollsTable.productionOrderId,
      }).from(fabricRollsTable).where(
        and(eq(fabricRollsTable.tenantId, tenantId), or(...fabricRollConditions)),
      ).orderBy(desc(fabricRollsTable.createdAt)).limit(limitPerType),
      db.select({
        id: productionOrdersTable.id,
        orderNumber: productionOrdersTable.orderNumber,
        batchId: productionOrdersTable.batchId,
        status: productionOrdersTable.status,
        fabricType: productionOrdersTable.fabricType,
      }).from(productionOrdersTable).where(
        and(eq(productionOrdersTable.tenantId, tenantId), or(...productionOrderConditions)),
      ).orderBy(desc(productionOrdersTable.createdAt)).limit(limitPerType),
      db.select({
        id: salesOrdersTable.id,
        orderNumber: salesOrdersTable.orderNumber,
        invoiceNumber: salesOrdersTable.invoiceNumber,
        status: salesOrdersTable.status,
        customerId: salesOrdersTable.customerId,
      }).from(salesOrdersTable).where(
        and(eq(salesOrdersTable.tenantId, tenantId), or(...salesOrderConditions)),
      ).orderBy(desc(salesOrdersTable.createdAt)).limit(limitPerType),
      db.select({
        id: warehousesTable.id,
        name: warehousesTable.name,
        location: warehousesTable.location,
        isActive: warehousesTable.isActive,
      }).from(warehousesTable).where(
        and(eq(warehousesTable.tenantId, tenantId), or(...warehouseConditions)),
      ).orderBy(warehousesTable.name).limit(limitPerType),
    ]);

    return { fabricRolls, productionOrders, salesOrders, warehouses };
  },
});
