import { Router } from "express";
import { db, customersTable, salesOrdersTable, fabricRollsTable, auditLogsTable } from "@workspace/db";
import { eq, and, desc, ilike, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { checkPlanAccess } from "../lib/billing";
import {
  ListCustomersQueryParams,
  ListCustomersResponse,
  CreateCustomerBody,
  GetCustomerParams,
  GetCustomerResponse,
  UpdateCustomerParams,
  UpdateCustomerBody,
  UpdateCustomerResponse,
  ListSalesOrdersQueryParams,
  ListSalesOrdersResponse,
  CreateSalesOrderBody,
  GetSalesOrderParams,
  GetSalesOrderResponse,
  UpdateSalesOrderParams,
  UpdateSalesOrderBody,
  UpdateSalesOrderResponse,
} from "@workspace/api-zod";

const router = Router();

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

// Customers
router.get("/customers", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = ListCustomersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [eq(customersTable.tenantId, req.user!.tenantId)];
  if (params.data.search) conditions.push(ilike(customersTable.name, `%${params.data.search}%`));

  const customers = await db.select().from(customersTable)
    .where(and(...conditions))
    .orderBy(customersTable.name)
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  res.json(ListCustomersResponse.parse(customers.map(formatCustomer)));
});

router.post("/customers", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [customer] = await db.insert(customersTable).values({
    tenantId: req.user!.tenantId,
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    address: parsed.data.address ?? null,
    taxNumber: parsed.data.taxNumber ?? null,
    isActive: true,
  }).returning();

  res.status(201).json(GetCustomerResponse.parse(formatCustomer(customer)));
});

router.get("/customers/:id", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(
    and(eq(customersTable.id, params.data.id), eq(customersTable.tenantId, req.user!.tenantId))
  );

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.json(GetCustomerResponse.parse(formatCustomer(customer)));
});

router.patch("/customers/:id", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.email != null) updates.email = parsed.data.email;
  if (parsed.data.phone != null) updates.phone = parsed.data.phone;
  if (parsed.data.address != null) updates.address = parsed.data.address;
  if (parsed.data.taxNumber != null) updates.taxNumber = parsed.data.taxNumber;
  if (parsed.data.isActive != null) updates.isActive = parsed.data.isActive;

  const [customer] = await db.update(customersTable).set(updates).where(
    and(eq(customersTable.id, params.data.id), eq(customersTable.tenantId, req.user!.tenantId))
  ).returning();

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.json(UpdateCustomerResponse.parse(formatCustomer(customer)));
});

// Sales Orders
router.get("/sales-orders", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = ListSalesOrdersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [eq(salesOrdersTable.tenantId, req.user!.tenantId)];
  if (params.data.status) conditions.push(eq(salesOrdersTable.status, params.data.status));
  if (params.data.customerId) conditions.push(eq(salesOrdersTable.customerId, params.data.customerId));

  const orders = await db.select().from(salesOrdersTable)
    .where(and(...conditions))
    .orderBy(desc(salesOrdersTable.createdAt))
    .limit(params.data.limit ?? 100)
    .offset(params.data.offset ?? 0);

  res.json(ListSalesOrdersResponse.parse(orders.map(formatSalesOrder)));
});

router.post("/sales-orders", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const parsed = CreateSalesOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { customerId, rollIds, totalAmount, notes } = parsed.data;
  const orderNumber = `SO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const [customer] = await db.select().from(customersTable).where(
    and(eq(customersTable.id, customerId), eq(customersTable.tenantId, req.user!.tenantId))
  );

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  if (rollIds && rollIds.length > 0) {
    const tenantRolls = await db.select({ id: fabricRollsTable.id }).from(fabricRollsTable).where(
      and(inArray(fabricRollsTable.id, rollIds), eq(fabricRollsTable.tenantId, req.user!.tenantId))
    );

    if (tenantRolls.length !== rollIds.length) {
      res.status(400).json({ error: "One or more selected rolls do not belong to this tenant" });
      return;
    }
  }

  const [order] = await db.insert(salesOrdersTable).values({
    tenantId: req.user!.tenantId,
    orderNumber,
    customerId,
    status: "DRAFT",
    totalAmount: totalAmount ?? 0,
    rollIds: rollIds ?? [],
    notes: notes ?? null,
    invoiceNumber: null,
  }).returning();

  // Reserve rolls
  if (rollIds && rollIds.length > 0) {
    await db.update(fabricRollsTable).set({ status: "RESERVED" })
      .where(and(inArray(fabricRollsTable.id, rollIds), eq(fabricRollsTable.tenantId, req.user!.tenantId)));
  }

  await db.insert(auditLogsTable).values({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    entityType: "sales_order",
    entityId: order.id,
    action: "CREATE",
    changes: JSON.stringify({ orderNumber, totalAmount }),
  });

  res.status(201).json(GetSalesOrderResponse.parse(formatSalesOrder(order)));
});

router.get("/sales-orders/:id", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = GetSalesOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [order] = await db.select().from(salesOrdersTable).where(
    and(eq(salesOrdersTable.id, params.data.id), eq(salesOrdersTable.tenantId, req.user!.tenantId))
  );

  if (!order) {
    res.status(404).json({ error: "Sales order not found" });
    return;
  }

  res.json(GetSalesOrderResponse.parse(formatSalesOrder(order)));
});

router.patch("/sales-orders/:id", requireAuth, checkPlanAccess("pro"), async (req, res): Promise<void> => {
  const params = UpdateSalesOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateSalesOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status != null) updates.status = parsed.data.status;
  if (parsed.data.totalAmount != null) updates.totalAmount = parsed.data.totalAmount;
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;
  if (parsed.data.invoiceNumber != null) updates.invoiceNumber = parsed.data.invoiceNumber;

  const [existing] = await db.select().from(salesOrdersTable).where(
    and(eq(salesOrdersTable.id, params.data.id), eq(salesOrdersTable.tenantId, req.user!.tenantId))
  );

  if (!existing) {
    res.status(404).json({ error: "Sales order not found" });
    return;
  }

  const [order] = await db.update(salesOrdersTable).set(updates).where(
    and(eq(salesOrdersTable.id, params.data.id), eq(salesOrdersTable.tenantId, req.user!.tenantId))
  ).returning();

  // If delivered, mark rolls as SOLD
  if (parsed.data.status === "DELIVERED" && existing.rollIds && existing.rollIds.length > 0) {
    await db.update(fabricRollsTable).set({ status: "SOLD" })
      .where(and(inArray(fabricRollsTable.id, existing.rollIds), eq(fabricRollsTable.tenantId, req.user!.tenantId)));
  }

  res.json(UpdateSalesOrderResponse.parse(formatSalesOrder(order)));
});

export default router;
