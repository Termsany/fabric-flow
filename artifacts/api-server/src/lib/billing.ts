import type { NextFunction, Request, Response } from "express";
import { and, count, eq } from "drizzle-orm";
import { db, tenantsTable, usersTable, warehousesTable, type Tenant } from "@workspace/db";

export type BillingPlan = "basic" | "pro" | "enterprise";
export type BillingInterval = "monthly" | "yearly";

export const BILLING_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
] as const;

export type BillingStatus = typeof BILLING_STATUSES[number];

export const PLAN_LIMITS: Record<BillingPlan, { users: number | null; warehouses: number | null }> = {
  basic: { users: 5, warehouses: 1 },
  pro: { users: 20, warehouses: 5 },
  enterprise: { users: null, warehouses: null },
};

export const PLAN_PRICES: Record<BillingPlan, Record<BillingInterval, number>> = {
  basic: { monthly: 49, yearly: 490 },
  pro: { monthly: 149, yearly: 1490 },
  enterprise: { monthly: 499, yearly: 4990 },
};

const PLAN_RANK: Record<BillingPlan, number> = {
  basic: 1,
  pro: 2,
  enterprise: 3,
};

const PRICE_MAP = Object.fromEntries(
  [
    [process.env.STRIPE_PRICE_BASIC_MONTHLY, { plan: "basic", interval: "monthly" }],
    [process.env.STRIPE_PRICE_BASIC_YEARLY, { plan: "basic", interval: "yearly" }],
    [process.env.STRIPE_PRICE_PRO_MONTHLY, { plan: "pro", interval: "monthly" }],
    [process.env.STRIPE_PRICE_PRO_YEARLY, { plan: "pro", interval: "yearly" }],
  ].filter((entry): entry is [string, { plan: BillingPlan; interval: BillingInterval }] => Boolean(entry[0])),
) satisfies Record<string, { plan: BillingPlan; interval: BillingInterval }>;

export function normalizePlan(value: string | null | undefined): BillingPlan {
  if (value === "basic" || value === "pro" || value === "enterprise") {
    return value;
  }

  return "enterprise";
}

export function normalizeStatus(value: string | null | undefined): BillingStatus {
  if (value && BILLING_STATUSES.includes(value as BillingStatus)) {
    return value as BillingStatus;
  }

  return "incomplete";
}

export function isSubscriptionActive(status: string | null | undefined, subscriptionEndsAt?: Date | null): boolean {
  if (status === "active" || status === "trialing") {
    return true;
  }

  if (status === "canceled" && subscriptionEndsAt && subscriptionEndsAt.getTime() > Date.now()) {
    return true;
  }

  return false;
}

export function getPlanFromPriceId(priceId: string): { plan: BillingPlan; interval: BillingInterval } | null {
  return PRICE_MAP[priceId] ?? null;
}

export function getExpectedPlanAmount(plan: BillingPlan, interval: BillingInterval | null | undefined): number {
  return PLAN_PRICES[plan][interval === "yearly" ? "yearly" : "monthly"];
}

export async function getTenantBilling(tenantId: number): Promise<Tenant | undefined> {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  return tenant;
}

export async function getTenantUsage(tenantId: number): Promise<{
  users: number;
  warehouses: number;
}> {
  const [[userCount], [warehouseCount]] = await Promise.all([
    db.select({ count: count() }).from(usersTable).where(eq(usersTable.tenantId, tenantId)),
    db.select({ count: count() }).from(warehousesTable).where(eq(warehousesTable.tenantId, tenantId)),
  ]);

  return {
    users: userCount?.count ?? 0,
    warehouses: warehouseCount?.count ?? 0,
  };
}

export function getResolvedLimits(tenant: Tenant): { users: number | null; warehouses: number | null } {
  const defaults = PLAN_LIMITS[normalizePlan(tenant.currentPlan)];
  return {
    users: tenant.maxUsersOverride ?? defaults.users,
    warehouses: tenant.maxWarehousesOverride ?? defaults.warehouses,
  };
}

export async function ensureUsageWithinLimit(
  tenantId: number,
  metric: "users" | "warehouses",
): Promise<{ allowed: boolean; limit: number | null; current: number }> {
  const tenant = await getTenantBilling(tenantId);
  if (!tenant) {
    return { allowed: false, limit: 0, current: 0 };
  }

  const usage = await getTenantUsage(tenantId);
  const limit = getResolvedLimits(tenant)[metric];
  const current = usage[metric];

  return {
    allowed: limit == null || current < limit,
    limit,
    current,
  };
}

export function checkSubscription() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const tenant = await getTenantBilling(req.user.tenantId);
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    if (!isSubscriptionActive(tenant.billingStatus, tenant.subscriptionEndsAt)) {
      res.status(402).json({
        error: "Subscription is not active",
        billingStatus: tenant.billingStatus,
        currentPlan: tenant.currentPlan,
      });
      return;
    }

    next();
  };
}

export function checkPlanAccess(requiredPlan: BillingPlan) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const tenant = await getTenantBilling(req.user.tenantId);
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const currentPlan = normalizePlan(tenant.currentPlan);
    if (!isSubscriptionActive(tenant.billingStatus, tenant.subscriptionEndsAt)) {
      res.status(402).json({
        error: "Subscription is not active",
        billingStatus: tenant.billingStatus,
        currentPlan,
      });
      return;
    }

    if (PLAN_RANK[currentPlan] < PLAN_RANK[requiredPlan]) {
      res.status(403).json({
        error: "Current subscription plan does not include this feature",
        currentPlan,
        requiredPlan,
      });
      return;
    }

    next();
  };
}

export async function setTenantBillingByStripeIds(args: {
  customerId?: string | null;
  subscriptionId?: string | null;
  updates: Partial<typeof tenantsTable.$inferInsert>;
}): Promise<Tenant | undefined> {
  const conditions = [];

  if (args.customerId) {
    conditions.push(eq(tenantsTable.stripeCustomerId, args.customerId));
  }

  if (args.subscriptionId) {
    conditions.push(eq(tenantsTable.stripeSubscriptionId, args.subscriptionId));
  }

  if (conditions.length === 0) {
    return undefined;
  }

  const [tenant] = await db
    .update(tenantsTable)
    .set(args.updates)
    .where(conditions.length === 1 ? conditions[0]! : and(...conditions))
    .returning();

  return tenant;
}
