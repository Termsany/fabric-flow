import { Router } from "express";
import { and, asc, count, desc, eq, ilike, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  adminAuditLogsTable,
  invoicesTable,
  plansTable,
  tenantsTable,
  usersTable,
  warehousesTable,
  fabricRollsTable,
  productionOrdersTable,
  salesOrdersTable,
  auditLogsTable,
} from "@workspace/db";
import {
  requireAuth,
  requireAdminPermission,
  hasAdminPermission,
  signToken,
  writeAdminAuditLog,
} from "../lib/auth";
import { PLAN_LIMITS, normalizePlan } from "../lib/billing";

const router = Router();

const listTenantsQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  plan: z.string().trim().min(1).optional(),
});

const tenantIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const updateTenantStatusSchema = z.object({
  isActive: z.boolean(),
});

const updateTenantPlanSchema = z.object({
  plan: z.string().trim().min(1),
  subscriptionStatus: z.enum(["trialing", "active", "past_due", "canceled", "unpaid", "incomplete"]).optional(),
});

const extendTrialSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

const updateBillingStatusSchema = z.object({
  billingStatus: z.enum(["trialing", "active", "past_due", "canceled", "unpaid", "incomplete"]),
  isActive: z.boolean().optional(),
  cancelMode: z.enum(["immediate", "end_of_period"]).optional(),
});

router.get("/admin/tenants", requireAuth, requireAdminPermission("tenants.read"), async (req, res): Promise<void> => {
  const parsed = listTenantsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [];
  if (parsed.data.search) {
    conditions.push(ilike(tenantsTable.name, `%${parsed.data.search}%`));
  }
  if (parsed.data.status) {
    conditions.push(eq(tenantsTable.isActive, parsed.data.status === "active"));
  }
  if (parsed.data.plan) {
    conditions.push(eq(tenantsTable.currentPlan, parsed.data.plan));
  }

  const tenants = await db.select({
    id: tenantsTable.id,
    name: tenantsTable.name,
    industry: tenantsTable.industry,
    country: tenantsTable.country,
    isActive: tenantsTable.isActive,
    currentPlan: tenantsTable.currentPlan,
    billingStatus: tenantsTable.billingStatus,
    subscriptionInterval: tenantsTable.subscriptionInterval,
    subscriptionEndsAt: tenantsTable.subscriptionEndsAt,
    trialEndsAt: tenantsTable.trialEndsAt,
    createdAt: tenantsTable.createdAt,
    usersCount: count(usersTable.id),
  })
    .from(tenantsTable)
    .leftJoin(usersTable, eq(usersTable.tenantId, tenantsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tenantsTable.id)
    .orderBy(desc(tenantsTable.createdAt), asc(tenantsTable.id));

  await writeAdminAuditLog({
    req,
    action: "TENANTS_LIST_VIEWED",
    entityType: "tenant",
    metadata: parsed.data,
  });

  res.setHeader("Cache-Control", "no-store");
  res.json(tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    industry: tenant.industry,
    country: tenant.country,
    isActive: tenant.isActive,
    currentPlan: tenant.currentPlan,
    billingStatus: tenant.billingStatus,
    subscriptionInterval: tenant.subscriptionInterval ?? null,
    subscriptionEndsAt: tenant.subscriptionEndsAt?.toISOString() ?? null,
    trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
    usersCount: tenant.usersCount,
    createdAt: tenant.createdAt.toISOString(),
  })));
});

router.get("/admin/tenants/:id", requireAuth, requireAdminPermission("tenants.read"), async (req, res): Promise<void> => {
  const params = tenantIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid tenant id" });
    return;
  }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, params.data.id));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const canReadBilling = hasAdminPermission(req.user!.role, "billing.read");

  const [stats] = await db.select({
    usersCount: sql<number>`(select count(*) from users where tenant_id = ${tenant.id})`.mapWith(Number),
    activeUsersCount: sql<number>`(select count(*) from users where tenant_id = ${tenant.id} and is_active = true)`.mapWith(Number),
    warehousesCount: sql<number>`(select count(*) from warehouses where tenant_id = ${tenant.id})`.mapWith(Number),
    rollsCount: sql<number>`(select count(*) from fabric_rolls where tenant_id = ${tenant.id})`.mapWith(Number),
    inStockRolls: sql<number>`(select count(*) from fabric_rolls where tenant_id = ${tenant.id} and status = 'IN_STOCK')`.mapWith(Number),
    reservedRolls: sql<number>`(select count(*) from fabric_rolls where tenant_id = ${tenant.id} and status = 'RESERVED')`.mapWith(Number),
    soldRolls: sql<number>`(select count(*) from fabric_rolls where tenant_id = ${tenant.id} and status = 'SOLD')`.mapWith(Number),
    activeProductionOrders: sql<number>`(select count(*) from production_orders where tenant_id = ${tenant.id} and status = 'IN_PROGRESS')`.mapWith(Number),
    activeSalesOrders: sql<number>`(select count(*) from sales_orders where tenant_id = ${tenant.id} and status in ('DRAFT', 'CONFIRMED', 'INVOICED'))`.mapWith(Number),
  }).from(tenantsTable).where(eq(tenantsTable.id, tenant.id));

  const users = await db.select({
    id: usersTable.id,
    fullName: usersTable.fullName,
    email: usersTable.email,
    role: usersTable.role,
    isActive: usersTable.isActive,
  }).from(usersTable)
    .where(eq(usersTable.tenantId, tenant.id))
    .orderBy(asc(usersTable.id))
    .limit(50);

  const logs = await db.select({
    id: auditLogsTable.id,
    action: auditLogsTable.action,
    entityType: auditLogsTable.entityType,
    entityId: auditLogsTable.entityId,
    changes: auditLogsTable.changes,
    createdAt: auditLogsTable.createdAt,
    userId: auditLogsTable.userId,
    userName: usersTable.fullName,
  }).from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .where(eq(auditLogsTable.tenantId, tenant.id))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(15);

  const invoiceHistory = await db.select({
    id: invoicesTable.id,
    invoiceNumber: invoicesTable.invoiceNumber,
    amount: invoicesTable.amount,
    currency: invoicesTable.currency,
    status: invoicesTable.status,
    issuedAt: invoicesTable.issuedAt,
    dueAt: invoicesTable.dueAt,
    paidAt: invoicesTable.paidAt,
  }).from(invoicesTable)
    .where(eq(invoicesTable.tenantId, tenant.id))
    .orderBy(desc(invoicesTable.issuedAt))
    .limit(10);

  const billingActionLogs = await db.select({
    id: adminAuditLogsTable.id,
    action: adminAuditLogsTable.action,
    adminEmail: adminAuditLogsTable.adminEmail,
    adminRole: adminAuditLogsTable.adminRole,
    severity: adminAuditLogsTable.severity,
    metadata: adminAuditLogsTable.metadata,
    createdAt: adminAuditLogsTable.createdAt,
  }).from(adminAuditLogsTable)
    .where(eq(adminAuditLogsTable.targetTenantId, tenant.id))
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(12);

  const plan = normalizePlan(tenant.currentPlan);
  const defaultLimits = PLAN_LIMITS[plan];
  const fallbackFeatures = {
    dashboard: true,
    rolls: true,
    production: true,
    warehouses: true,
    qc: plan !== "basic",
    dyeing: plan !== "basic",
    sales: plan !== "basic",
    auditLogs: plan !== "basic",
  };

  await writeAdminAuditLog({
    req,
    action: "TENANT_VIEWED",
    entityType: "tenant",
    entityId: tenant.id,
    targetTenantId: tenant.id,
  });

  res.json({
    id: tenant.id,
    name: tenant.name,
    industry: tenant.industry,
    country: tenant.country,
    isActive: tenant.isActive,
    currentPlan: tenant.currentPlan,
    billingStatus: tenant.billingStatus,
    subscriptionInterval: tenant.subscriptionInterval,
    subscriptionEndsAt: tenant.subscriptionEndsAt?.toISOString() ?? null,
    trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
    stripeCustomerId: canReadBilling ? (tenant.stripeCustomerId ?? null) : null,
    stripeSubscriptionId: canReadBilling ? (tenant.stripeSubscriptionId ?? null) : null,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
    permissions: {
      plan,
      features: fallbackFeatures,
      limits: {
        users: tenant.maxUsersOverride ?? defaultLimits.users,
        warehouses: tenant.maxWarehousesOverride ?? defaultLimits.warehouses,
      },
    },
    usage: stats,
    users,
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      changes: log.changes ?? null,
      userId: log.userId ?? null,
      userName: log.userName ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
    invoiceHistory: canReadBilling
      ? invoiceHistory.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          currency: invoice.currency,
          status: invoice.status,
          issuedAt: invoice.issuedAt.toISOString(),
          dueAt: invoice.dueAt?.toISOString() ?? null,
          paidAt: invoice.paidAt?.toISOString() ?? null,
        }))
      : [],
    billingActionLogs: canReadBilling
      ? billingActionLogs.map((entry) => ({
          id: entry.id,
          action: entry.action,
          adminEmail: entry.adminEmail,
          adminRole: entry.adminRole,
          severity: entry.severity,
          metadata: entry.metadata,
          createdAt: entry.createdAt.toISOString(),
        }))
      : [],
  });
});

router.patch("/admin/tenants/:id/status", requireAuth, requireAdminPermission("tenants.write"), async (req, res): Promise<void> => {
  const params = tenantIdParamsSchema.safeParse(req.params);
  const parsed = updateTenantStatusSchema.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [tenant] = await db.update(tenantsTable)
    .set({ isActive: parsed.data.isActive })
    .where(eq(tenantsTable.id, params.data.id))
    .returning();

  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  await writeAdminAuditLog({
    req,
    action: tenant.isActive ? "TENANT_ACTIVATED" : "TENANT_DEACTIVATED",
    entityType: "tenant",
    entityId: tenant.id,
    targetTenantId: tenant.id,
    severity: tenant.isActive ? "info" : "warning",
    metadata: { isActive: tenant.isActive },
  });

  res.setHeader("Cache-Control", "no-store");
  res.json({
    id: tenant.id,
    name: tenant.name,
    isActive: tenant.isActive,
    currentPlan: tenant.currentPlan,
    billingStatus: tenant.billingStatus,
    updatedAt: tenant.updatedAt.toISOString(),
  });
});

router.patch("/admin/tenants/:id/plan", requireAuth, requireAdminPermission("billing.write"), async (req, res): Promise<void> => {
  const params = tenantIdParamsSchema.safeParse(req.params);
  const parsed = updateTenantPlanSchema.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.success ? { id: ["Invalid tenant id"] } : parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const normalizedPlanCode = parsed.data.plan.trim().toLowerCase();
  const [plan] = await db
    .select({
      id: plansTable.id,
      code: plansTable.code,
      isActive: plansTable.isActive,
    })
    .from(plansTable)
    .where(eq(plansTable.code, normalizedPlanCode));

  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  if (!plan.isActive) {
    res.status(400).json({ error: "Selected plan is inactive" });
    return;
  }

  const [tenant] = await db.update(tenantsTable)
    .set({
      currentPlan: plan.code,
      billingStatus: parsed.data.subscriptionStatus ?? "active",
      subscriptionInterval: plan.code === "enterprise" ? null : "monthly",
    })
    .where(eq(tenantsTable.id, params.data.id))
    .returning();

  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  await writeAdminAuditLog({
    req,
    action: "TENANT_PLAN_UPDATED",
    entityType: "tenant_billing",
    entityId: tenant.id,
    targetTenantId: tenant.id,
    metadata: {
      currentPlan: tenant.currentPlan,
      billingStatus: tenant.billingStatus,
    },
  });

  res.setHeader("Cache-Control", "no-store");
  res.json({
    id: tenant.id,
    name: tenant.name,
    isActive: tenant.isActive,
    currentPlan: tenant.currentPlan,
    billingStatus: tenant.billingStatus,
    updatedAt: tenant.updatedAt.toISOString(),
  });
});

router.patch("/admin/tenants/:id/trial", requireAuth, requireAdminPermission("billing.write"), async (req, res): Promise<void> => {
  const params = tenantIdParamsSchema.safeParse(req.params);
  const parsed = extendTrialSchema.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [existing] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  const baseDate = existing.trialEndsAt && existing.trialEndsAt > new Date() ? existing.trialEndsAt : new Date();
  const trialEndsAt = new Date(baseDate);
  trialEndsAt.setDate(trialEndsAt.getDate() + parsed.data.days);

  const [tenant] = await db.update(tenantsTable)
    .set({
      trialEndsAt,
      subscriptionEndsAt: trialEndsAt,
      billingStatus: "trialing",
    })
    .where(eq(tenantsTable.id, params.data.id))
    .returning();

  await writeAdminAuditLog({
    req,
    action: "TENANT_TRIAL_EXTENDED",
    entityType: "tenant_billing",
    entityId: tenant.id,
    targetTenantId: tenant.id,
    metadata: { days: parsed.data.days, trialEndsAt: trialEndsAt.toISOString() },
  });

  res.json({
    id: tenant.id,
    trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
    subscriptionEndsAt: tenant.subscriptionEndsAt?.toISOString() ?? null,
    billingStatus: tenant.billingStatus,
  });
});

router.patch("/admin/tenants/:id/billing-status", requireAuth, requireAdminPermission("billing.write"), async (req, res): Promise<void> => {
  const params = tenantIdParamsSchema.safeParse(req.params);
  const parsed = updateBillingStatusSchema.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const cancelMode = parsed.data.billingStatus === "canceled"
    ? parsed.data.cancelMode ?? "end_of_period"
    : undefined;
  const nextSubscriptionEndsAt = parsed.data.billingStatus === "canceled"
    ? (cancelMode === "immediate" ? new Date() : undefined)
    : undefined;

  const [tenant] = await db.update(tenantsTable)
    .set({
      billingStatus: parsed.data.billingStatus,
      isActive: parsed.data.isActive ?? true,
      subscriptionEndsAt: nextSubscriptionEndsAt,
    })
    .where(eq(tenantsTable.id, params.data.id))
    .returning();

  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  await writeAdminAuditLog({
    req,
    action: "TENANT_BILLING_STATUS_UPDATED",
    entityType: "tenant_billing",
    entityId: tenant.id,
    targetTenantId: tenant.id,
    severity: parsed.data.billingStatus === "past_due" || parsed.data.billingStatus === "unpaid" ? "warning" : "info",
    metadata: { ...parsed.data, cancelMode: cancelMode ?? null },
  });

  res.json({
    id: tenant.id,
    billingStatus: tenant.billingStatus,
    isActive: tenant.isActive,
    updatedAt: tenant.updatedAt.toISOString(),
  });
});

router.post("/admin/tenants/:id/billing-sync", requireAuth, requireAdminPermission("billing.read"), async (req, res): Promise<void> => {
  const params = tenantIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid tenant id" });
    return;
  }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, params.data.id));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  await writeAdminAuditLog({
    req,
    action: "TENANT_BILLING_SYNC_REQUESTED",
    entityType: "tenant_billing",
    entityId: tenant.id,
    targetTenantId: tenant.id,
    metadata: {
      stripeCustomerId: tenant.stripeCustomerId ?? null,
      stripeSubscriptionId: tenant.stripeSubscriptionId ?? null,
      billingStatus: tenant.billingStatus,
      currentPlan: tenant.currentPlan,
    },
  });

  res.json({
    id: tenant.id,
    stripeCustomerId: tenant.stripeCustomerId ?? null,
    stripeSubscriptionId: tenant.stripeSubscriptionId ?? null,
    billingStatus: tenant.billingStatus,
    currentPlan: tenant.currentPlan,
    subscriptionInterval: tenant.subscriptionInterval ?? null,
    subscriptionEndsAt: tenant.subscriptionEndsAt?.toISOString() ?? null,
    trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
    lastInvoiceStatus: tenant.lastInvoiceStatus ?? null,
  });
});

router.post("/admin/tenants/:id/impersonate", requireAuth, requireAdminPermission("tenants.impersonate"), async (req, res): Promise<void> => {
  const params = tenantIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid tenant id" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(
    and(
      eq(usersTable.tenantId, params.data.id),
      inArray(usersTable.role, ["tenant_admin", "admin"]),
      eq(usersTable.isActive, true),
    ),
  );

  if (!user) {
    res.status(404).json({ error: "No active tenant admin found for impersonation" });
    return;
  }

  await writeAdminAuditLog({
    req,
    action: "TENANT_IMPERSONATION_STARTED",
    entityType: "tenant_user",
    entityId: user.id,
    targetTenantId: user.tenantId,
    severity: "warning",
    metadata: { impersonatedUserEmail: user.email },
  });

  const token = signToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  });

  res.json({
    token,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  });
});

router.get("/admin/billing", requireAuth, requireAdminPermission("billing.read"), async (req, res): Promise<void> => {
  const rows = await db.select({
    id: tenantsTable.id,
    name: tenantsTable.name,
    currentPlan: tenantsTable.currentPlan,
    billingStatus: tenantsTable.billingStatus,
    isActive: tenantsTable.isActive,
    subscriptionInterval: tenantsTable.subscriptionInterval,
    subscriptionEndsAt: tenantsTable.subscriptionEndsAt,
    trialEndsAt: tenantsTable.trialEndsAt,
    lastInvoiceStatus: tenantsTable.lastInvoiceStatus,
    usersCount: sql<number>`(select count(*) from users where tenant_id = ${tenantsTable.id})`.mapWith(Number),
  }).from(tenantsTable).orderBy(asc(tenantsTable.name));

  const recentBillingAuditLogs = await db.select({
    id: adminAuditLogsTable.id,
    adminEmail: adminAuditLogsTable.adminEmail,
    adminRole: adminAuditLogsTable.adminRole,
    action: adminAuditLogsTable.action,
    entityType: adminAuditLogsTable.entityType,
    entityId: adminAuditLogsTable.entityId,
    targetTenantId: adminAuditLogsTable.targetTenantId,
    severity: adminAuditLogsTable.severity,
    metadata: adminAuditLogsTable.metadata,
    createdAt: adminAuditLogsTable.createdAt,
  }).from(adminAuditLogsTable)
    .where(sql`${adminAuditLogsTable.action} in (
      'PLAN_PRICE_UPDATED',
      'PLAN_PRICE_APPLIED_ALL',
      'PLAN_PRICE_APPLIED_SELECTED',
      'PAYMENT_APPROVED',
      'PAYMENT_REJECTED',
      'PAYMENT_MARKED_PENDING_REVIEW',
      'TENANT_PLAN_UPDATED',
      'TENANT_BILLING_STATUS_UPDATED',
      'TENANT_TRIAL_EXTENDED'
    )`)
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(15);

  const planValueMap: Record<string, number> = {
    basic: 49,
    pro: 149,
    enterprise: 499,
  };

  const summary = rows.reduce((acc, row) => {
    acc.totalSubscriptions += 1;
    if (row.billingStatus === "active") acc.activeSubscriptions += 1;
    if (row.billingStatus === "trialing") acc.trialingSubscriptions += 1;
    if (row.billingStatus === "past_due") acc.pastDueSubscriptions += 1;
    if (row.billingStatus === "canceled") acc.canceledSubscriptions += 1;
    if (row.billingStatus === "active" || row.billingStatus === "trialing") {
      acc.mrrEstimate += planValueMap[normalizePlan(row.currentPlan)];
    }
    return acc;
  }, {
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    trialingSubscriptions: 0,
    pastDueSubscriptions: 0,
    canceledSubscriptions: 0,
    mrrEstimate: 0,
  });

  const now = Date.now();
  const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;

  const alerts = rows.flatMap((row) => {
    const items: Array<{
      id: string;
      tenantId: number;
      tenantName: string;
      severity: "high" | "medium";
      type: "past_due" | "payment_failed" | "ending_soon";
      message: string;
    }> = [];

    if (["past_due", "unpaid", "incomplete"].includes(row.billingStatus)) {
      items.push({
        id: `past-due-${row.id}`,
        tenantId: row.id,
        tenantName: row.name,
        severity: "high",
        type: "past_due",
        message: `Billing status is ${row.billingStatus}`,
      });
    }

    if ((row.lastInvoiceStatus ?? "").includes("failed") || row.lastInvoiceStatus === "manual_payment_rejected") {
      items.push({
        id: `payment-failed-${row.id}`,
        tenantId: row.id,
        tenantName: row.name,
        severity: "high",
        type: "payment_failed",
        message: `Last payment status is ${row.lastInvoiceStatus}`,
      });
    }

    const endingAt = row.subscriptionEndsAt ?? row.trialEndsAt;
    if (endingAt) {
      const endingTs = endingAt.getTime();
      if (endingTs >= now && endingTs <= sevenDaysFromNow) {
        items.push({
          id: `ending-soon-${row.id}`,
          tenantId: row.id,
          tenantName: row.name,
          severity: "medium",
          type: "ending_soon",
          message: `Subscription ends on ${endingAt.toISOString()}`,
        });
      }
    }

    return items;
  });

  await writeAdminAuditLog({
    req,
    action: "ADMIN_BILLING_DASHBOARD_VIEWED",
    entityType: "platform_billing",
  });

  res.json({
    summary,
    alerts,
    auditLogs: recentBillingAuditLogs.map((entry) => ({
      id: entry.id,
      adminEmail: entry.adminEmail,
      adminRole: entry.adminRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      targetTenantId: entry.targetTenantId ?? null,
      severity: entry.severity,
      metadata: entry.metadata ?? null,
      createdAt: entry.createdAt.toISOString(),
    })),
    subscriptions: rows.map((row) => ({
      id: row.id,
      name: row.name,
      currentPlan: row.currentPlan,
      billingStatus: row.billingStatus,
      isActive: row.isActive,
      subscriptionInterval: row.subscriptionInterval ?? null,
      subscriptionEndsAt: row.subscriptionEndsAt?.toISOString() ?? null,
      trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
      lastInvoiceStatus: row.lastInvoiceStatus ?? null,
      usersCount: row.usersCount,
    })),
  });
});

router.get("/admin/monitoring", requireAuth, requireAdminPermission("monitoring.read"), async (req, res): Promise<void> => {
  const [summary] = await db.select({
    totalTenants: count(),
    activeTenants: sql<number>`count(*) filter (where is_active = true)`.mapWith(Number),
    inactiveTenants: sql<number>`count(*) filter (where is_active = false)`.mapWith(Number),
    pastDueTenants: sql<number>`count(*) filter (where billing_status = 'past_due')`.mapWith(Number),
    trialingTenants: sql<number>`count(*) filter (where billing_status = 'trialing')`.mapWith(Number),
  }).from(tenantsTable);

  const topActiveTenants = await db.select({
    id: tenantsTable.id,
    name: tenantsTable.name,
    activityCount: sql<number>`count(${auditLogsTable.id})`.mapWith(Number),
    rollsCount: sql<number>`(select count(*) from fabric_rolls where tenant_id = ${tenantsTable.id})`.mapWith(Number),
    salesCount: sql<number>`(select count(*) from sales_orders where tenant_id = ${tenantsTable.id})`.mapWith(Number),
  }).from(tenantsTable)
    .leftJoin(auditLogsTable, eq(auditLogsTable.tenantId, tenantsTable.id))
    .groupBy(tenantsTable.id)
    .orderBy(desc(sql`count(${auditLogsTable.id})`))
    .limit(6);

  const recentActivity = await db.select({
    id: auditLogsTable.id,
    tenantId: auditLogsTable.tenantId,
    tenantName: tenantsTable.name,
    action: auditLogsTable.action,
    entityType: auditLogsTable.entityType,
    entityId: auditLogsTable.entityId,
    createdAt: auditLogsTable.createdAt,
  }).from(auditLogsTable)
    .innerJoin(tenantsTable, eq(auditLogsTable.tenantId, tenantsTable.id))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(20);

  const apiUsage = await db.execute(sql`
    select to_char(created_at, 'YYYY-MM-DD') as day, count(*)::int as count
    from audit_logs
    where created_at >= now() - interval '7 days'
    group by 1
    order by 1 asc
  `);

  const [rollCountRow] = await db.select({
    count: count(),
  }).from(fabricRollsTable);

  const rollCount = rollCountRow?.count ?? 0;
  const estimatedStorageGb = Math.round((rollCount * 0.006) * 10) / 10;

  const alerts = [];
  const billingAlerts = await db.select({
    id: tenantsTable.id,
    name: tenantsTable.name,
    billingStatus: tenantsTable.billingStatus,
  }).from(tenantsTable)
    .where(sql`${tenantsTable.billingStatus} in ('past_due', 'unpaid', 'incomplete')`)
    .limit(10);

  for (const tenant of billingAlerts) {
    alerts.push({
      id: `billing-${tenant.id}`,
      severity: "high",
      type: "billing",
      tenantName: tenant.name,
      message: `Billing issue: ${tenant.billingStatus}`,
    });
  }

  const inactiveAlerts = await db.select({
    id: tenantsTable.id,
    name: tenantsTable.name,
  }).from(tenantsTable)
    .where(eq(tenantsTable.isActive, false))
    .limit(10);

  for (const tenant of inactiveAlerts) {
    alerts.push({
      id: `inactive-${tenant.id}`,
      severity: "medium",
      type: "tenant",
      tenantName: tenant.name,
      message: "Tenant is disabled",
    });
  }

  const adminLogs = await db.select({
    id: adminAuditLogsTable.id,
    adminEmail: adminAuditLogsTable.adminEmail,
    adminRole: adminAuditLogsTable.adminRole,
    action: adminAuditLogsTable.action,
    entityType: adminAuditLogsTable.entityType,
    createdAt: adminAuditLogsTable.createdAt,
    severity: adminAuditLogsTable.severity,
  }).from(adminAuditLogsTable)
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(20);

  await writeAdminAuditLog({
    req,
    action: "ADMIN_MONITORING_VIEWED",
    entityType: "platform_monitoring",
  });

  res.json({
    summary: {
      ...summary,
      apiRequestsLast7Days: apiUsage.rows.reduce((sum, row) => sum + Number((row as { count: number }).count), 0),
      estimatedStorageGb,
    },
    activityLogs: recentActivity.map((entry) => ({
      id: entry.id,
      tenantId: entry.tenantId,
      tenantName: entry.tenantName,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      createdAt: entry.createdAt.toISOString(),
    })),
    apiUsage: apiUsage.rows.map((row) => ({
      label: String((row as { day: string }).day),
      count: Number((row as { count: number }).count),
    })),
    storageUsage: {
      usedGb: estimatedStorageGb,
      capacityGb: Math.max(20, summary.totalTenants * 12),
    },
    topActiveTenants,
    alerts,
    systemLogs: adminLogs.map((entry) => ({
      id: entry.id,
      adminEmail: entry.adminEmail,
      adminRole: entry.adminRole,
      action: entry.action,
      entityType: entry.entityType,
      severity: entry.severity,
      createdAt: entry.createdAt.toISOString(),
    })),
  });
});

export default router;
