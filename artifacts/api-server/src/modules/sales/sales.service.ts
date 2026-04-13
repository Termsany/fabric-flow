import { customersTable, salesOrdersTable } from "@workspace/db";
import { FABRIC_ROLL_WORKFLOW_STATUS, SALES_WORKFLOW_STATUS, WORKFLOW_DEFAULTS } from "@workspace/api-zod";
import { salesRepository } from "./sales.repository";
import { buildSalesStockSources, validateDeliverableRolls, validateSellableRolls } from "./sales.inventory";
import { buildAuditChanges, pickAuditFields } from "../../utils/audit-log";
import { buildSalesReport, type SalesReportTotals, type SalesStatusCount } from "./sales.reporting";
import { buildSalesOrderWorkflowSummary } from "./sales.workflow";
import { assertSalesOrderTransitionAllowed } from "../workflow/transition-guards";

function formatCustomer(c: typeof customersTable.$inferSelect) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    address: c.address ?? null,
    taxNumber: c.taxNumber ?? null,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function formatSalesOrder(o: typeof salesOrdersTable.$inferSelect) {
  return {
    id: o.id,
    tenantId: o.tenantId,
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    status: o.status,
    totalAmount: o.totalAmount,
    rollIds: o.rollIds ?? [],
    invoiceNumber: o.invoiceNumber ?? null,
    notes: o.notes ?? null,
    workflow: buildSalesOrderWorkflowSummary(o),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

function formatSalesOrderWithStockSources(
  order: typeof salesOrdersTable.$inferSelect,
  stockSources: Array<{ fabricRollId: number; warehouseId: number | null }>,
) {
  return {
    ...formatSalesOrder(order),
    stockSources,
  };
}

export type SalesServiceDependencies = {
  salesRepository: {
    listCustomers: (tenantId: number, options: { search?: string; limit: number; offset: number }) => Promise<Array<typeof customersTable.$inferSelect>>;
    createCustomer: (values: typeof customersTable.$inferInsert) => Promise<Array<typeof customersTable.$inferSelect>>;
    findCustomerById: (tenantId: number, id: number) => Promise<Array<typeof customersTable.$inferSelect>>;
    updateCustomer: (tenantId: number, id: number, updates: Record<string, unknown>) => Promise<Array<typeof customersTable.$inferSelect>>;
    listSalesOrders: (tenantId: number, options: { status?: string; customerId?: number; search?: string; limit: number; offset: number }) => Promise<Array<typeof salesOrdersTable.$inferSelect>>;
    findTenantRollIds: (tenantId: number, rollIds: number[]) => Promise<Array<{ id: number; status: string; warehouseId: number | null }>>;
    createSalesOrder: (values: typeof salesOrdersTable.$inferInsert) => Promise<Array<typeof salesOrdersTable.$inferSelect>>;
    updateRollStatusForTenant: (tenantId: number, rollIds: number[], status: string | undefined) => Promise<unknown>;
    createWarehouseMovements: (values: Array<{
      tenantId: number;
      fabricRollId: number;
      fromWarehouseId: number | null;
      toWarehouseId: number | null;
      movedById: number;
      reason?: string | null;
      movedAt?: Date;
    }>) => Promise<unknown>;
    insertAuditLog: (values: unknown) => Promise<unknown>;
    findSalesOrderById: (tenantId: number, id: number) => Promise<Array<typeof salesOrdersTable.$inferSelect>>;
    updateSalesOrder: (tenantId: number, id: number, updates: Record<string, unknown>) => Promise<Array<typeof salesOrdersTable.$inferSelect>>;
    getSalesReportTotals: (tenantId: number) => Promise<SalesReportTotals[]>;
    listSalesStatusCounts: (tenantId: number) => Promise<SalesStatusCount[]>;
    listRecentSales: (tenantId: number, limit: number) => Promise<Array<typeof salesOrdersTable.$inferSelect>>;
  };
};

export function createSalesService(deps: SalesServiceDependencies = { salesRepository }) {
  const { salesRepository } = deps;

  return {
  async listCustomers(tenantId: number, params: { search?: string; limit?: number; offset?: number }) {
    const customers = await salesRepository.listCustomers(tenantId, {
      search: params.search,
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    });

    return customers.map(formatCustomer);
  },

  async createCustomer(tenantId: number, data: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    taxNumber?: string | null;
  }) {
    const [customer] = await salesRepository.createCustomer({
      tenantId,
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      taxNumber: data.taxNumber ?? null,
      isActive: true,
    });

    return formatCustomer(customer);
  },

  async getCustomer(tenantId: number, id: number) {
    const [customer] = await salesRepository.findCustomerById(tenantId, id);
    return customer ? formatCustomer(customer) : null;
  },

  async updateCustomer(tenantId: number, id: number, data: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    taxNumber?: string | null;
    isActive?: boolean;
  }) {
    const updates: Record<string, unknown> = {};
    if (data.name != null) updates.name = data.name;
    if (data.email != null) updates.email = data.email;
    if (data.phone != null) updates.phone = data.phone;
    if (data.address != null) updates.address = data.address;
    if (data.taxNumber != null) updates.taxNumber = data.taxNumber;
    if (data.isActive != null) updates.isActive = data.isActive;

    const [customer] = await salesRepository.updateCustomer(tenantId, id, updates);
    return customer ? formatCustomer(customer) : null;
  },

  async listSalesOrders(tenantId: number, params: { status?: string; customerId?: number; search?: string; limit?: number; offset?: number }) {
    const orders = await salesRepository.listSalesOrders(tenantId, {
      status: params.status,
      customerId: params.customerId,
      search: params.search,
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    });

    return orders.map(formatSalesOrder);
  },

  async getSalesReport(tenantId: number, params: { recentLimit?: number } = {}) {
    const recentLimit = Math.min(Math.max(params.recentLimit ?? 5, 1), 20);
    const [[totals], statusCounts, recentSales] = await Promise.all([
      salesRepository.getSalesReportTotals(tenantId),
      salesRepository.listSalesStatusCounts(tenantId),
      salesRepository.listRecentSales(tenantId, recentLimit),
    ]);

    return buildSalesReport({
      totals: totals ?? {
        totalSalesCount: 0,
        deliveredSalesCount: 0,
        pendingSalesCount: 0,
        recordedTotalAmount: 0,
        totalRollsAllocated: 0,
        deliveredRolls: 0,
      },
      statusCounts,
      recentSales,
    });
  },

  async createSalesOrder(tenantId: number, userId: number, data: {
    customerId: number;
    rollIds?: number[];
    totalAmount?: number;
    notes?: string | null;
  }) {
    const orderNumber = `SO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [customer] = await salesRepository.findCustomerById(tenantId, data.customerId);
    if (!customer) {
      return { error: "Customer not found" as const };
    }

    const rollIds = data.rollIds ?? [];
    let stockSources: Array<{ fabricRollId: number; warehouseId: number | null }> = [];
    if (rollIds.length > 0) {
      const tenantRolls = await salesRepository.findTenantRollIds(tenantId, rollIds);
      const availabilityError = validateSellableRolls(rollIds, tenantRolls);
      if (availabilityError) {
        return availabilityError;
      }

      stockSources = buildSalesStockSources(tenantRolls);
    }

    const [order] = await salesRepository.createSalesOrder({
      tenantId,
      orderNumber,
      customerId: data.customerId,
      status: WORKFLOW_DEFAULTS.salesOrderStatus,
      totalAmount: data.totalAmount ?? 0,
      rollIds,
      notes: data.notes ?? null,
      invoiceNumber: null,
    });

    if (rollIds.length > 0) {
      await salesRepository.updateRollStatusForTenant(tenantId, rollIds, FABRIC_ROLL_WORKFLOW_STATUS.reserved);
      await salesRepository.createWarehouseMovements(
        stockSources
          .filter((source) => source.warehouseId != null)
          .map((source) => ({
            tenantId,
            fabricRollId: source.fabricRollId,
            fromWarehouseId: source.warehouseId ?? null,
            toWarehouseId: source.warehouseId ?? null,
            movedById: userId,
            reason: `Reserved for sales order ${orderNumber}`,
            movedAt: new Date(),
          })),
      );
    }

    await salesRepository.insertAuditLog({
      tenantId,
      userId,
      entityType: "sales_order",
      entityId: order.id,
      action: "CREATE",
      changes: buildAuditChanges({
        before: null,
        after: {
          status: order.status,
          totalAmount: data.totalAmount ?? 0,
          rollIds,
        },
        context: {
          orderNumber,
          customerId: data.customerId,
          stockSources,
          reservedRollIds: rollIds,
        },
      }),
    });

    return { data: formatSalesOrderWithStockSources(order, stockSources) };
  },

  async getSalesOrder(tenantId: number, id: number) {
    const [order] = await salesRepository.findSalesOrderById(tenantId, id);
    return order ? formatSalesOrder(order) : null;
  },

  async updateSalesOrder(tenantId: number, id: number, data: {
    status?: typeof salesOrdersTable.$inferInsert.status;
    totalAmount?: number;
    notes?: string | null;
    invoiceNumber?: string | null;
  }, userId: number | null = null) {
    const [existing] = await salesRepository.findSalesOrderById(tenantId, id);
    if (!existing) {
      return { error: "Sales order not found" as const };
    }

    if (data.status != null && data.status !== existing.status) {
      try {
        assertSalesOrderTransitionAllowed(existing.status, data.status);
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Invalid sales order status transition",
          status: 400 as const,
        };
      }
    }

    const updates: Record<string, unknown> = {};
    if (data.status != null) updates.status = data.status;
    if (data.totalAmount != null) updates.totalAmount = data.totalAmount;
    if (data.notes != null) updates.notes = data.notes;
    if (data.invoiceNumber != null) updates.invoiceNumber = data.invoiceNumber;

    const shouldMarkRollsSold = data.status === SALES_WORKFLOW_STATUS.delivered && existing.rollIds && existing.rollIds.length > 0;
    let deliveryStockSources: Array<{ fabricRollId: number; warehouseId: number | null }> = [];
    if (shouldMarkRollsSold) {
      const tenantRolls = await salesRepository.findTenantRollIds(tenantId, existing.rollIds);
      const deliveryError = validateDeliverableRolls(existing.rollIds, tenantRolls);
      if (deliveryError) {
        return deliveryError;
      }

      deliveryStockSources = buildSalesStockSources(tenantRolls);
    }

    const [order] = await salesRepository.updateSalesOrder(tenantId, id, updates);

    if (shouldMarkRollsSold) {
      await salesRepository.updateRollStatusForTenant(tenantId, existing.rollIds, FABRIC_ROLL_WORKFLOW_STATUS.sold);
      await salesRepository.createWarehouseMovements(
        deliveryStockSources
          .filter((source) => source.warehouseId != null)
          .map((source) => ({
            tenantId,
            fabricRollId: source.fabricRollId,
            fromWarehouseId: source.warehouseId ?? null,
            toWarehouseId: null,
            movedById: userId ?? 0,
            reason: `Outbound delivery for sales order ${order.orderNumber}`,
            movedAt: new Date(),
          })),
      );
    }

    await salesRepository.insertAuditLog({
      tenantId,
      userId,
      entityType: "sales_order",
      entityId: order.id,
      action: shouldMarkRollsSold ? "SALES_FINALIZED" : data.status != null && data.status !== existing.status ? "SALES_STATUS_CHANGED" : "UPDATE",
      changes: buildAuditChanges({
        before: pickAuditFields(existing, ["status", "totalAmount", "notes", "invoiceNumber"]),
        after: pickAuditFields(order, ["status", "totalAmount", "notes", "invoiceNumber"]),
        context: {
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          rollIds: order.rollIds ?? [],
          stockSources: deliveryStockSources,
          affectedRollStatus: shouldMarkRollsSold ? FABRIC_ROLL_WORKFLOW_STATUS.sold : null,
        },
      }),
    });

    return { data: formatSalesOrder(order) };
  },
  };
}

export const salesService = createSalesService();
