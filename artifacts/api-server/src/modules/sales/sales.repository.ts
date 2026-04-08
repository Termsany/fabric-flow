import { db, auditLogsTable, customersTable, fabricRollsTable, salesOrdersTable } from "@workspace/db";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";

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

  listSalesOrders(tenantId: number, options: { status?: string; customerId?: number; limit: number; offset: number }) {
    const conditions = [eq(salesOrdersTable.tenantId, tenantId)];
    if (options.status) {
      conditions.push(eq(salesOrdersTable.status, options.status as typeof salesOrdersTable.$inferSelect.status));
    }
    if (options.customerId) {
      conditions.push(eq(salesOrdersTable.customerId, options.customerId));
    }

    return db.select().from(salesOrdersTable)
      .where(and(...conditions))
      .orderBy(desc(salesOrdersTable.createdAt))
      .limit(options.limit)
      .offset(options.offset);
  },

  findTenantRollIds(tenantId: number, rollIds: number[]) {
    return db.select({ id: fabricRollsTable.id }).from(fabricRollsTable).where(
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
};
