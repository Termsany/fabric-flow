import { db, auditLogsTable, customersTable, fabricRollsTable, salesOrdersTable, warehouseMovementsTable } from "@workspace/db";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { normalizeIdentifierSearch } from "../../utils/identifiers";

export const salesRepository = {
  listCustomers(tenantId: number, options: { search?: string; limit: number; offset: number }) {
    const conditions = [eq(customersTable.tenantId, tenantId)];
    if (options.search) {
      conditions.push(ilike(customersTable.name, `%${options.search}%`));
    }

    return db.select().from(customersTable)
      .where(and(...conditions))
      .orderBy(customersTable.name)
      .limit(options.limit)
      .offset(options.offset);
  },

  createCustomer(values: typeof customersTable.$inferInsert) {
    return db.insert(customersTable).values(values).returning();
  },

  findCustomerById(tenantId: number, id: number) {
    return db.select().from(customersTable).where(
      and(eq(customersTable.id, id), eq(customersTable.tenantId, tenantId)),
    );
  },

  updateCustomer(tenantId: number, id: number, updates: Record<string, unknown>) {
    return db.update(customersTable).set(updates).where(
      and(eq(customersTable.id, id), eq(customersTable.tenantId, tenantId)),
    ).returning();
  },

  listSalesOrders(tenantId: number, options: { status?: string; customerId?: number; search?: string; limit: number; offset: number }) {
    const conditions = [eq(salesOrdersTable.tenantId, tenantId)];
    if (options.status) {
      conditions.push(eq(salesOrdersTable.status, options.status as typeof salesOrdersTable.$inferSelect.status));
    }
    if (options.customerId) {
      conditions.push(eq(salesOrdersTable.customerId, options.customerId));
    }
    const identifierSearch = normalizeIdentifierSearch(options.search);
    if (identifierSearch) {
      const searchConditions = [
        ilike(salesOrdersTable.orderNumber, identifierSearch.pattern),
        ilike(salesOrdersTable.invoiceNumber, identifierSearch.pattern),
      ];
      if (identifierSearch.numericId != null) {
        searchConditions.push(eq(salesOrdersTable.id, identifierSearch.numericId));
        searchConditions.push(eq(salesOrdersTable.customerId, identifierSearch.numericId));
      }
      conditions.push(or(...searchConditions)!);
    }

    return db.select().from(salesOrdersTable)
      .where(and(...conditions))
      .orderBy(desc(salesOrdersTable.createdAt))
      .limit(options.limit)
      .offset(options.offset);
  },

  findTenantRollIds(tenantId: number, rollIds: number[]) {
    return db.select({
      id: fabricRollsTable.id,
      status: fabricRollsTable.status,
      warehouseId: fabricRollsTable.warehouseId,
    }).from(fabricRollsTable).where(
      and(inArray(fabricRollsTable.id, rollIds), eq(fabricRollsTable.tenantId, tenantId)),
    );
  },

  createSalesOrder(values: typeof salesOrdersTable.$inferInsert) {
    return db.insert(salesOrdersTable).values(values).returning();
  },

  updateRollStatusForTenant(tenantId: number, rollIds: number[], status: typeof fabricRollsTable.$inferInsert.status) {
    return db.update(fabricRollsTable).set({ status })
      .where(and(inArray(fabricRollsTable.id, rollIds), eq(fabricRollsTable.tenantId, tenantId)));
  },

  createWarehouseMovements(values: Array<{
    tenantId: number;
    fabricRollId: number;
    fromWarehouseId: number | null;
    toWarehouseId: number | null;
    movedById: number;
    reason?: string | null;
    movedAt?: Date;
  }>) {
    if (values.length === 0) return [];
    return db.insert(warehouseMovementsTable).values(values).returning();
  },

  insertAuditLog(values: typeof auditLogsTable.$inferInsert) {
    return db.insert(auditLogsTable).values(values);
  },

  findSalesOrderById(tenantId: number, id: number) {
    return db.select().from(salesOrdersTable).where(
      and(eq(salesOrdersTable.id, id), eq(salesOrdersTable.tenantId, tenantId)),
    );
  },

  updateSalesOrder(tenantId: number, id: number, updates: Record<string, unknown>) {
    return db.update(salesOrdersTable).set(updates).where(
      and(eq(salesOrdersTable.id, id), eq(salesOrdersTable.tenantId, tenantId)),
    ).returning();
  },

  getSalesReportTotals(tenantId: number) {
    return db.select({
      totalSalesCount: count(),
      deliveredSalesCount: sql<number>`count(*) filter (where ${salesOrdersTable.status} = 'DELIVERED')`.mapWith(Number),
      pendingSalesCount: sql<number>`count(*) filter (where ${salesOrdersTable.status} in ('DRAFT', 'CONFIRMED'))`.mapWith(Number),
      recordedTotalAmount: sql<number>`coalesce(sum(${salesOrdersTable.totalAmount}), 0)`.mapWith(Number),
      totalRollsAllocated: sql<number>`coalesce(sum(cardinality(${salesOrdersTable.rollIds})), 0)`.mapWith(Number),
      deliveredRolls: sql<number>`coalesce(sum(cardinality(${salesOrdersTable.rollIds})) filter (where ${salesOrdersTable.status} = 'DELIVERED'), 0)`.mapWith(Number),
    }).from(salesOrdersTable).where(eq(salesOrdersTable.tenantId, tenantId));
  },

  listSalesStatusCounts(tenantId: number) {
    return db.select({
      status: salesOrdersTable.status,
      count: count(),
    }).from(salesOrdersTable)
      .where(eq(salesOrdersTable.tenantId, tenantId))
      .groupBy(salesOrdersTable.status);
  },

  listRecentSales(tenantId: number, limit: number) {
    return db.select().from(salesOrdersTable)
      .where(eq(salesOrdersTable.tenantId, tenantId))
      .orderBy(desc(salesOrdersTable.createdAt))
      .limit(limit);
  },
};
