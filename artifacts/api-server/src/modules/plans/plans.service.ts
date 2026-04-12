import type { Request } from "express";
import { db, planFeaturesTable, planPricesTable, plansTable, tenantSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createValidationError, AppError } from "../../utils/errors";
import { normalizeStatus, type BillingPlan, type BillingStatus } from "../../lib/billing";
import { isTenantRole } from "../../lib/auth";
import { writeAdminAuditLog } from "../../lib/auth";
import { paymentMethodsService } from "../payment-methods/payment-methods.service";
import { plansRepository } from "./plans.repository";
import type { PlanDto, TenantSubscriptionDto, SubscriptionStatus } from "./plans.types";
import { buildSubscriptionStatusSummary } from "../../lib/subscription-state";

type PlanUpsertInput = {
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  isActive: boolean;
  sortOrder: number;
  prices: Array<{
    interval: "monthly" | "yearly";
    currency: string;
    amount: number;
    trialDays: number;
    stripePriceId?: string | null;
    localPaymentEnabled: boolean;
    isActive: boolean;
  }>;
  features: Array<{
    featureKey: string;
    labelAr: string;
    labelEn: string;
    included: boolean;
    sortOrder: number;
  }>;
};

function getUsdExchangeRate() {
  const parsed = Number(process.env.PRICING_GOOGLE_USD_RATE || process.env.GOOGLE_USD_RATE || 50);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

function normalizeCurrency(currency: string | null | undefined): "USD" | "EGP" {
  return String(currency || "").toUpperCase() === "USD" ? "USD" : "EGP";
}

function convertEgpToUsd(amount: number) {
  const rate = getUsdExchangeRate();
  return Math.round((amount / rate) * 100) / 100;
}

function convertUsdToEgp(amount: number) {
  return Math.round(amount * getUsdExchangeRate());
}

function addPeriod(date: Date, interval: "monthly" | "yearly") {
  const next = new Date(date);
  if (interval === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function mapPlan(plan: Awaited<ReturnType<typeof plansRepository.listPlans>>[number], prices: Awaited<ReturnType<typeof plansRepository.listPrices>>, features: Awaited<ReturnType<typeof plansRepository.listFeatures>>, subscriberCount = 0): PlanDto {
  const usdExchangeRate = getUsdExchangeRate();
  return {
    id: plan.id,
    code: plan.code,
    nameAr: plan.nameAr,
    nameEn: plan.nameEn,
    descriptionAr: plan.descriptionAr ?? null,
    descriptionEn: plan.descriptionEn ?? null,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
    subscribersCount: subscriberCount,
    prices: prices
      .filter((price) => price.planId === plan.id)
      .sort((a, b) => a.interval.localeCompare(b.interval))
      .map((price) => {
        const currency = normalizeCurrency(price.currency);
        const usdAmount = currency === "USD" ? price.amount : convertEgpToUsd(price.amount);
        const egpAmount = currency === "EGP" ? price.amount : convertUsdToEgp(price.amount);
        return {
          id: price.id,
          interval: price.interval as "monthly" | "yearly",
          currency,
          amount: price.amount,
          usdAmount,
          egpAmount,
          baseCurrency: currency,
          usdCurrency: "USD",
          egpCurrency: "EGP",
          usdExchangeRate,
          trialDays: price.trialDays,
          stripePriceId: price.stripePriceId ?? null,
          localPaymentEnabled: price.localPaymentEnabled,
          isActive: price.isActive,
        };
      }),
    features: features
      .filter((feature) => feature.planId === plan.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((feature) => ({
        id: feature.id,
        featureKey: feature.featureKey,
        labelAr: feature.labelAr,
        labelEn: feature.labelEn,
        included: feature.included,
        sortOrder: feature.sortOrder,
      })),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export class PlansService {
  async listAdminPlans() {
    const [plans, subscriberCounts] = await Promise.all([
      plansRepository.listPlans(),
      plansRepository.listSubscriberCounts(),
    ]);
    const prices = await plansRepository.listPrices(plans.map((plan) => plan.id));
    const features = await plansRepository.listFeatures(plans.map((plan) => plan.id));
    const countByPlanId = new Map(subscriberCounts.map((item) => [item.planId, Number(item.count)]));

    return plans.map((plan) => mapPlan(plan, prices, features, countByPlanId.get(plan.id) ?? 0));
  }

  async listPublicPlans() {
    const plans = (await this.listAdminPlans()).filter((plan) => plan.isActive);
    return plans.map((plan) => ({
      ...plan,
      prices: plan.prices.filter((price) => price.isActive),
    }));
  }

  async upsertPlan(req: Request, planId: number | null, payload: PlanUpsertInput) {
    const existingByCode = await plansRepository.getPlanByCode(payload.code);
    if (existingByCode && existingByCode.id !== planId) {
      throw createValidationError({ code: ["Plan code already exists"] });
    }

    const result = await db.transaction(async (tx) => {
      const plan = planId != null
        ? (await tx.select().from(plansTable).where(eq(plansTable.id, planId)))[0] ?? null
        : null;

      const savedPlan = plan
        ? (await tx.update(plansTable).set({
            code: payload.code,
            nameAr: payload.nameAr,
            nameEn: payload.nameEn,
            descriptionAr: payload.descriptionAr ?? null,
            descriptionEn: payload.descriptionEn ?? null,
            isActive: payload.isActive,
            sortOrder: payload.sortOrder,
          }).where(eq(plansTable.id, planId!)).returning())[0]
        : (await tx.insert(plansTable).values({
            code: payload.code,
            nameAr: payload.nameAr,
            nameEn: payload.nameEn,
            descriptionAr: payload.descriptionAr ?? null,
            descriptionEn: payload.descriptionEn ?? null,
            isActive: payload.isActive,
            sortOrder: payload.sortOrder,
          }).returning())[0];

      await tx.delete(planFeaturesTable).where(eq(planFeaturesTable.planId, savedPlan.id));

      if (payload.prices.length > 0) {
        const existingPrices = await tx.select().from(planPricesTable).where(eq(planPricesTable.planId, savedPlan.id));

        for (const price of payload.prices) {
          const existingPrice = existingPrices.find((item) => item.interval === price.interval);
          if (existingPrice) {
            await tx
              .update(planPricesTable)
              .set({
                currency: price.currency,
                amount: price.amount,
                trialDays: price.trialDays,
                stripePriceId: price.stripePriceId ?? null,
                localPaymentEnabled: price.localPaymentEnabled,
                isActive: price.isActive,
              })
              .where(eq(planPricesTable.id, existingPrice.id));
          } else {
            await tx.insert(planPricesTable).values({
              planId: savedPlan.id,
              interval: price.interval,
              currency: price.currency,
              amount: price.amount,
              trialDays: price.trialDays,
              stripePriceId: price.stripePriceId ?? null,
              localPaymentEnabled: price.localPaymentEnabled,
              isActive: price.isActive,
            });
          }
        }
      }

      if (payload.features.length > 0) {
        await tx.insert(planFeaturesTable).values(payload.features.map((feature) => ({
          planId: savedPlan.id,
          featureKey: feature.featureKey,
          labelAr: feature.labelAr,
          labelEn: feature.labelEn,
          included: feature.included,
          sortOrder: feature.sortOrder,
        })));
      }

      return savedPlan;
    });

    await writeAdminAuditLog({
      req,
      action: planId ? "PLAN_UPDATED" : "PLAN_CREATED",
      entityType: "plan",
      entityId: result.id,
      severity: "info",
      metadata: { code: payload.code },
    });

    const plans = await this.listAdminPlans();
    return plans.find((plan) => plan.id === result.id)!;
  }

  async ensureTenantSubscription(tenantId: number) {
    const existing = await plansRepository.getTenantSubscription(tenantId);
    if (existing) return existing;

    const tenant = await plansRepository.getTenantById(tenantId);
    if (!tenant) throw new AppError("Tenant not found", 404);

    const planCode = (tenant.currentPlan || "enterprise") as BillingPlan;
    const plan = await plansRepository.getPlanByCode(planCode);
    if (!plan) throw new AppError("Plan not found", 404);

    const interval = tenant.subscriptionInterval === "yearly" ? "yearly" : "monthly";
    const planPrice = await plansRepository.getPlanPrice(plan.id, interval);

    return db.transaction(async (tx) => {
      const [created] = await tx.insert(tenantSubscriptionsTable).values({
        tenantId,
        planId: plan.id,
        planPriceId: planPrice?.id ?? null,
        amount: planPrice?.amount ?? null,
        status: tenant.billingStatus,
        paymentProvider: tenant.stripeSubscriptionId ? "stripe" : null,
        paymentMethodCode: null,
        startedAt: tenant.createdAt,
        currentPeriodStart: tenant.createdAt,
        currentPeriodEnd: tenant.subscriptionEndsAt,
        trialEndsAt: tenant.trialEndsAt,
        cancelAtPeriodEnd: tenant.billingStatus === "canceled",
        canceledAt: tenant.billingStatus === "canceled" ? tenant.subscriptionEndsAt : null,
        metadata: { migratedFromTenant: true },
      }).returning();
      return created!;
    });
  }

  async getTenantSubscriptionDto(tenantId: number): Promise<TenantSubscriptionDto> {
    const current = await this.ensureTenantSubscription(tenantId);
    const plan = await plansRepository.getPlanById(current.planId);
    if (!plan) throw new AppError("Plan not found", 404);
    const prices = await plansRepository.listPrices([plan.id]);
    const features = await plansRepository.listFeatures([plan.id]);
    const currentPrice = prices.find((price) => price.id === current.planPriceId) ?? null;
    const baseCurrency = normalizeCurrency(currentPrice?.currency);
    const amountUsd = current.amount == null ? null : (baseCurrency === "USD" ? current.amount : convertEgpToUsd(current.amount));
    const amountEgp = current.amount == null ? null : (baseCurrency === "EGP" ? current.amount : convertUsdToEgp(current.amount));

    return {
      id: current.id,
      tenantId,
      amount: current.amount ?? null,
      amountUsd,
      amountEgp,
      baseCurrency,
      usdCurrency: "USD",
      egpCurrency: "EGP",
      usdExchangeRate: getUsdExchangeRate(),
      status: normalizeStatus(current.status) as SubscriptionStatus,
      paymentProvider: current.paymentProvider ?? null,
      paymentMethodCode: current.paymentMethodCode ?? null,
      cancelAtPeriodEnd: current.cancelAtPeriodEnd,
      startedAt: current.startedAt.toISOString(),
      currentPeriodStart: current.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: current.currentPeriodEnd?.toISOString() ?? null,
      trialEndsAt: current.trialEndsAt?.toISOString() ?? null,
      canceledAt: current.canceledAt?.toISOString() ?? null,
      metadata: (current.metadata as Record<string, unknown> | null) ?? {},
      statusSummary: buildSubscriptionStatusSummary({
        billingStatus: normalizeStatus(current.status),
        lastInvoiceStatus: null,
        cancelAtPeriodEnd: current.cancelAtPeriodEnd,
        currentPeriodEnd: current.currentPeriodEnd,
        subscriptionEndsAt: current.currentPeriodEnd,
        trialEndsAt: current.trialEndsAt,
      }),
      plan: mapPlan(plan, prices, features, 1),
    };
  }

  async subscribeTenant(req: Request, tenantId: number, planCode: string, interval: "monthly" | "yearly", paymentMethodCode?: string | null, notes?: string | null) {
    const plan = await plansRepository.getPlanByCode(planCode);
    if (!plan || !plan.isActive) {
      throw new AppError("Plan not found", 404);
    }
    const price = await plansRepository.getPlanPrice(plan.id, interval);
    if (!price || !price.isActive) {
      throw createValidationError({ interval: ["Selected pricing interval is unavailable"] });
    }
    if (paymentMethodCode) {
      const methods = await paymentMethodsService.listBillingVisiblePaymentMethods(tenantId);
      if (!methods.some((method) => method.code === paymentMethodCode)) {
        throw createValidationError({ paymentMethodCode: ["Selected payment method is unavailable for this tenant"] });
      }
    }

    const existing = await this.ensureTenantSubscription(tenantId);
    const now = new Date();
    const currentPeriodEnd = addPeriod(now, interval);
    const trialEndsAt = price.trialDays > 0 ? addDays(now, price.trialDays) : null;
    const nextStatus: BillingStatus = paymentMethodCode ? "incomplete" : "active";

    await db.transaction(async (tx) => {
      const updated = await plansRepository.upsertTenantSubscription(tx, tenantId, {
        tenantId,
        planId: plan.id,
        planPriceId: price.id,
        amount: price.amount,
        status: nextStatus,
        paymentProvider: paymentMethodCode ? "manual" : "internal",
        paymentMethodCode: paymentMethodCode ?? null,
        startedAt: existing.startedAt ?? now,
        currentPeriodStart: now,
        currentPeriodEnd,
        trialEndsAt,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        metadata: { source: "subscription-api", notes: notes ?? null },
      });

      await plansRepository.updateTenantLegacyBilling(tx, tenantId, {
        currentPlan: plan.code,
        subscriptionInterval: interval,
        billingStatus: nextStatus,
        subscriptionEndsAt: currentPeriodEnd,
        trialEndsAt,
      });

      await plansRepository.insertSubscriptionHistory(tx, {
        tenantId,
        tenantSubscriptionId: updated.id,
        action: existing.id ? "SUBSCRIBED" : "SUBSCRIPTION_CREATED",
        fromPlanId: existing.planId,
        toPlanId: plan.id,
        fromStatus: existing.status,
        toStatus: nextStatus,
        actorUserId: req.user && isTenantRole(req.user.role) ? req.user.userId : null,
        actorPlatformAdminId: req.user && req.user.tenantId === 0 && req.user.userId > 0 ? req.user.userId : null,
        notes: notes ?? null,
        metadata: { interval, paymentMethodCode: paymentMethodCode ?? null },
      });
    });

    return this.getTenantSubscriptionDto(tenantId);
  }

  async cancelTenantSubscription(req: Request, tenantId: number, cancelAtPeriodEnd: boolean, notes?: string | null) {
    const existing = await this.ensureTenantSubscription(tenantId);
    const now = new Date();

    await db.transaction(async (tx) => {
      const updated = await plansRepository.upsertTenantSubscription(tx, tenantId, {
        tenantId: existing.tenantId,
        planId: existing.planId,
        planPriceId: existing.planPriceId,
        amount: existing.amount,
        status: "canceled",
        paymentProvider: existing.paymentProvider,
        paymentMethodCode: existing.paymentMethodCode,
        startedAt: existing.startedAt,
        currentPeriodStart: existing.currentPeriodStart,
        currentPeriodEnd: existing.currentPeriodEnd,
        trialEndsAt: existing.trialEndsAt,
        cancelAtPeriodEnd,
        canceledAt: now,
        metadata: { ...(existing.metadata as Record<string, unknown> | null ?? {}), notes: notes ?? null },
      });

      await plansRepository.updateTenantLegacyBilling(tx, tenantId, {
        billingStatus: "canceled",
        subscriptionEndsAt: cancelAtPeriodEnd ? existing.currentPeriodEnd : now,
      });

      await plansRepository.insertSubscriptionHistory(tx, {
        tenantId,
        tenantSubscriptionId: updated.id,
        action: "SUBSCRIPTION_CANCELED",
        fromPlanId: existing.planId,
        toPlanId: existing.planId,
        fromStatus: existing.status,
        toStatus: "canceled",
        actorUserId: req.user && isTenantRole(req.user.role) ? req.user.userId : null,
        actorPlatformAdminId: req.user && req.user.tenantId === 0 && req.user.userId > 0 ? req.user.userId : null,
        notes: notes ?? null,
        metadata: { cancelAtPeriodEnd },
      });
    });

    return this.getTenantSubscriptionDto(tenantId);
  }

  async listSubscriptionHistory(tenantId: number) {
    const history = await plansRepository.listSubscriptionHistory(tenantId);
    return history.map((entry) => ({
      id: entry.id,
      action: entry.action,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      notes: entry.notes ?? null,
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  async updatePlanPrice(req: Request, planId: number, input: {
    interval: "monthly" | "yearly";
    amount: number;
    currency: string;
    trialDays?: number;
    localPaymentEnabled?: boolean;
    isActive?: boolean;
  }) {
    const plan = await plansRepository.getPlanById(planId);
    if (!plan) {
      throw new AppError("Plan not found", 404);
    }

    const existingPrice = await plansRepository.getPlanPrice(planId, input.interval);
    await plansRepository.updatePlanPrice(planId, input.interval, {
      planId,
      interval: input.interval,
      amount: input.amount,
      currency: input.currency,
      trialDays: input.trialDays ?? existingPrice?.trialDays ?? 0,
      localPaymentEnabled: input.localPaymentEnabled ?? existingPrice?.localPaymentEnabled ?? true,
      isActive: input.isActive ?? existingPrice?.isActive ?? true,
      stripePriceId: existingPrice?.stripePriceId ?? null,
    });

    await writeAdminAuditLog({
      req,
      action: "PLAN_PRICE_UPDATED",
      entityType: "plan_price",
      entityId: planId,
      severity: "info",
      metadata: {
        interval: input.interval,
        amount: input.amount,
        currency: input.currency,
      },
    });

    const plans = await this.listAdminPlans();
    return plans.find((item) => item.id === planId)!;
  }

  async applyPlanPriceToSubscriptions(req: Request, planId: number, input: {
    interval: "monthly" | "yearly";
    tenantIds?: number[];
    applyOnNextBilling?: boolean;
  }) {
    const plan = await plansRepository.getPlanById(planId);
    if (!plan) {
      throw new AppError("Plan not found", 404);
    }

    const price = await plansRepository.getPlanPrice(planId, input.interval);
    if (!price) {
      throw createValidationError({ interval: ["Selected billing cycle price was not found"] });
    }

    const subscriptions = await plansRepository.listTenantSubscriptionsByPlanForInterval(planId, input.interval);
    const targetSubscriptions = subscriptions
      .map((entry) => entry.subscription)
      .filter((subscription) =>
        !input.tenantIds || input.tenantIds.includes(subscription.tenantId),
    );

    if (input.tenantIds?.length) {
      const foundTenantIds = new Set(targetSubscriptions.map((subscription) => subscription.tenantId));
      const missingTenantIds = input.tenantIds.filter((tenantId) => !foundTenantIds.has(tenantId));
      if (missingTenantIds.length > 0) {
        throw createValidationError({ tenantIds: [`Some selected tenants are not subscribed to this plan: ${missingTenantIds.join(", ")}`] });
      }
    }

    const updated = await db.transaction(async (tx) => {
      const rows: Array<typeof tenantSubscriptionsTable.$inferSelect> = [];

      for (const subscription of targetSubscriptions) {
        const [next] = await tx.update(tenantSubscriptionsTable)
          .set({
            planPriceId: price.id,
            amount: price.amount,
            metadata: {
              ...((subscription.metadata as Record<string, unknown> | null) ?? {}),
              priceAppliedAt: new Date().toISOString(),
              priceApplyMode: input.applyOnNextBilling === false ? "immediate" : "next_billing",
            },
          })
          .where(eq(tenantSubscriptionsTable.id, subscription.id))
          .returning();

        await plansRepository.insertSubscriptionHistory(tx, {
          tenantId: subscription.tenantId,
          tenantSubscriptionId: subscription.id,
          action: "PRICE_APPLIED",
          fromPlanId: subscription.planId,
          toPlanId: subscription.planId,
          fromStatus: subscription.status,
          toStatus: subscription.status,
          actorUserId: req.user && isTenantRole(req.user.role) ? req.user.userId : null,
          actorPlatformAdminId: req.user && req.user.tenantId === 0 && req.user.userId > 0 ? req.user.userId : null,
          notes: null,
          metadata: {
            interval: input.interval,
            amount: price.amount,
            applyOnNextBilling: input.applyOnNextBilling !== false,
          },
        });

        rows.push(next!);
      }

      return rows;
    });

    await writeAdminAuditLog({
      req,
      action: input.tenantIds?.length ? "PLAN_PRICE_APPLIED_SELECTED" : "PLAN_PRICE_APPLIED_ALL",
      entityType: "plan_price",
      entityId: planId,
      severity: "info",
      metadata: {
        interval: input.interval,
        amount: price.amount,
        tenantIds: input.tenantIds ?? "all",
        updatedCount: updated.length,
        applyOnNextBilling: input.applyOnNextBilling !== false,
      },
    });

    return {
      planId,
      interval: input.interval,
      amount: price.amount,
      updatedCount: updated.length,
      tenantIds: updated.map((item) => item.tenantId),
    };
  }
}

export const plansService = new PlansService();
