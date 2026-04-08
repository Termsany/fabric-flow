import { customersTable, salesOrdersTable } from "@workspace/db";
import { salesRepository } from "./sales.repository";

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
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

export type SalesServiceDependencies = {
  salesRepository: {
    listCustomers: (tenantId: number, options: { search?: string; limit: number; offset: number }) => Promise<Array<typeof customersTable.$inferSelect>>;
    createCustomer: (values: typeof customersTable.$inferInsert) => Promise<Array<typeof customersTable.$inferSelect>>;
    findCustomerById: (tenantId: number, id: number) => Promise<Array<typeof customersTable.$inferSelect>>;
    updateCustomer: (tenantId: number, id: number, updates: Record<string, unknown>) => Promise<Array<typeof customersTable.$inferSelect>>;
    listSalesOrders: (tenantId: number, options: { status?: string; customerId?: number; limit: number; offset: number }) => Promise<Array<typeof salesOrdersTable.$inferSelect>>;
    findTenantRollIds: (tenantId: number, rollIds: number[]) => Promise<Array<{ id: number }>>;
    createSalesOrder: (values: typeof salesOrdersTable.$inferInsert) => Promise<Array<typeof salesOrdersTable.$inferSelect>>;
    updateRollStatusForTenant: (tenantId: number, rollIds: number[], status: string | undefined) => Promise<unknown>;
    insertAuditLog: (values: unknown) => Promise<unknown>;
    findSalesOrderById: (tenantId: number, id: number) => Promise<Array<typeof salesOrdersTable.$inferSelect>>;
    updateSalesOrder: (tenantId: number, id: number, updates: Record<string, unknown>) => Promise<Array<typeof salesOrdersTable.$inferSelect>>;
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

  async listSalesOrders(tenantId: number, params: { status?: string; customerId?: number; limit?: number; offset?: number }) {
    const orders = await salesRepository.listSalesOrders(tenantId, {
      status: params.status,
      customerId: params.customerId,
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    });

    return orders.map(formatSalesOrder);
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
    if (rollIds.length > 0) {
      const tenantRolls = await salesRepository.findTenantRollIds(tenantId, rollIds);
      if (tenantRolls.length !== rollIds.length) {
        return { error: "One or more selected rolls do not belong to this tenant" as const, status: 400 as const };
      }
    }

    const [order] = await salesRepository.createSalesOrder({
      tenantId,
      orderNumber,
      customerId: data.customerId,
      status: "DRAFT",
      totalAmount: data.totalAmount ?? 0,
      rollIds,
      notes: data.notes ?? null,
      invoiceNumber: null,
    });

    if (rollIds.length > 0) {
      await salesRepository.updateRollStatusForTenant(tenantId, rollIds, "RESERVED");
    }

    await salesRepository.insertAuditLog({
      tenantId,
      userId,
      entityType: "sales_order",
      entityId: order.id,
      action: "CREATE",
      changes: JSON.stringify({ orderNumber, totalAmount: data.totalAmount ?? 0 }),
    });

    return { data: formatSalesOrder(order) };
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
  }) {
    const [existing] = await salesRepository.findSalesOrderById(tenantId, id);
    if (!existing) {
      return { error: "Sales order not found" as const };
    }

    const updates: Record<string, unknown> = {};
    if (data.status != null) updates.status = data.status;
    if (data.totalAmount != null) updates.totalAmount = data.totalAmount;
    if (data.notes != null) updates.notes = data.notes;
    if (data.invoiceNumber != null) updates.invoiceNumber = data.invoiceNumber;

    const [order] = await salesRepository.updateSalesOrder(tenantId, id, updates);

    if (data.status === "DELIVERED" && existing.rollIds && existing.rollIds.length > 0) {
      await salesRepository.updateRollStatusForTenant(tenantId, existing.rollIds, "SOLD");
    }

    return { data: formatSalesOrder(order) };
  },
  };
}

export const salesService = createSalesService();
