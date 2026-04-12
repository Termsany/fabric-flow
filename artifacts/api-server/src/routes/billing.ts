import path from "node:path";
import { Router, type Response } from "express";
import Stripe from "stripe";
import multer from "multer";
import {
  db,
  billingEventsTable,
  invoicesTable,
  paymentsTable,
  planPricesTable,
  tenantSubscriptionsTable,
  platformAdminsTable,
  tenantsTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { CreateBillingCheckoutSessionBody } from "@workspace/api-zod";
import {
  requireAdminPermission,
  requireAuth,
  requireTenantAdmin,
  writeAdminAuditLog,
} from "../lib/auth";
import {
  getExpectedPlanAmount,
  getPlanFromPriceId,
  getResolvedLimits,
  getTenantBilling,
  getTenantUsage,
  isSubscriptionActive,
  normalizePlan,
  normalizeStatus,
  setTenantBillingByStripeIds,
  type BillingInterval,
  type BillingPlan,
} from "../lib/billing";
import { isStripeConfigured, stripe } from "../lib/stripe";
import { logger } from "../lib/logger";
import { getPaymentProof, savePaymentProof } from "../lib/object-storage";
import { generatePaymentQr } from "../lib/payment-qr";
import { paymentMethodsService } from "../modules/payment-methods/payment-methods.service";
import { buildSubscriptionStatusSummary } from "../lib/subscription-state";
import { GetBillingSubscriptionResponse } from "@workspace/api-zod";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(new Error("Only JPG, PNG, and WEBP images are allowed"));
      return;
    }

    cb(null, true);
  },
});

function getAppUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function getApiBaseUrl(): string {
  const appUrl = getAppUrl();
  if (appUrl.includes("localhost:3000")) {
    return appUrl.replace("localhost:3000", "localhost:8080");
  }

  return appUrl;
}

function getProofFilename(proofImageUrl: string): string | null {
  if (!proofImageUrl) {
    return null;
  }

  try {
    if (/^https?:\/\//i.test(proofImageUrl)) {
      return path.basename(new URL(proofImageUrl).pathname);
    }
  } catch {
    return null;
  }

  return path.basename(proofImageUrl);
}

function getManualPaymentInstructions() {
  return {
    currency: process.env.PAYMENT_CURRENCY || "EGP",
    instapay: {
      account: process.env.INSTAPAY_ACCOUNT || "instapay@textileerp",
      note: process.env.INSTAPAY_NOTE || "حوّل المبلغ الكامل ثم ارفع إثبات العملية.",
    },
    vodafoneCash: {
      number: process.env.VODAFONE_CASH_NUMBER || "01000000000",
      note: process.env.VODAFONE_CASH_NOTE || "استخدم الرقم المخصص للشركة ثم أرفق صورة واضحة لإثبات الدفع.",
    },
  };
}

function getUsdExchangeRate(): number {
  const parsed = Number(process.env.PRICING_GOOGLE_USD_RATE || process.env.GOOGLE_USD_RATE || 50);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

function convertEgpToUsd(amount: number): number {
  return Math.round((amount / getUsdExchangeRate()) * 100) / 100;
}

function convertUsdToEgp(amount: number): number {
  return Math.round(amount * getUsdExchangeRate());
}

function normalizeBillingInterval(value: string | null | undefined): BillingInterval {
  return value === "yearly" ? "yearly" : "monthly";
}

function requireStripe(res: Response): boolean {
  if (!isStripeConfigured() || !stripe) {
    res.status(500).json({ error: "Stripe is not configured" });
    return false;
  }

  return true;
}

function resolvePriceId(plan: BillingPlan, interval: BillingInterval): string | null {
  const priceMap: Record<Exclude<BillingPlan, "enterprise">, Record<BillingInterval, string | undefined>> = {
    basic: {
      monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY,
      yearly: process.env.STRIPE_PRICE_BASIC_YEARLY,
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    },
  };

  if (plan === "enterprise") {
    return null;
  }

  return priceMap[plan][interval] ?? null;
}

function getTrialDays(trialEndsAt: Date | null): number | undefined {
  if (!trialEndsAt) {
    return undefined;
  }

  const diffMs = trialEndsAt.getTime() - Date.now();
  if (diffMs <= 0) {
    return undefined;
  }

  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

async function ensureStripeCustomer(tenantId: number): Promise<{ tenant: NonNullable<Awaited<ReturnType<typeof getTenantBilling>>>; customerId: string }> {
  const tenant = await getTenantBilling(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  if (tenant.stripeCustomerId) {
    return { tenant, customerId: tenant.stripeCustomerId };
  }

  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const customer = await stripe.customers.create({
    name: tenant.name,
    metadata: {
      tenantId: String(tenant.id),
      tenantName: tenant.name,
    },
  });

  const [updatedTenant] = await db
    .update(tenantsTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(tenantsTable.id, tenant.id))
    .returning();

  return {
    tenant: updatedTenant ?? tenant,
    customerId: customer.id,
  };
}

function getSubscriptionSnapshotArgs(tenant: NonNullable<Awaited<ReturnType<typeof getTenantBilling>>>, usage: Awaited<ReturnType<typeof getTenantUsage>>) {
  const plan = normalizePlan(tenant.currentPlan);
  const limits = getResolvedLimits(tenant);

  return {
    tenantId: tenant.id,
    currentPlan: plan,
    subscriptionInterval: tenant.subscriptionInterval,
    billingStatus: normalizeStatus(tenant.billingStatus),
    stripeCustomerId: tenant.stripeCustomerId,
    stripeSubscriptionId: tenant.stripeSubscriptionId,
    subscriptionEndsAt: tenant.subscriptionEndsAt?.toISOString() ?? null,
    trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
    lastInvoiceStatus: tenant.lastInvoiceStatus ?? null,
    isActive: isSubscriptionActive(tenant.billingStatus, tenant.subscriptionEndsAt),
    usage,
    limits,
    plans: [
      {
        key: "enterprise",
        name: "Open Plan",
        monthlyPriceId: null,
        yearlyPriceId: null,
        features: [
          "كل الوحدات التشغيلية",
          "عدد مستخدمين مفتوح",
          "عدد مخازن مفتوح",
          "الدفع اليدوي وطرق الدفع المحلية",
        ],
      },
    ],
    manualPayment: {
      amount: getExpectedPlanAmount(plan, normalizeBillingInterval(tenant.subscriptionInterval)),
      amountUsd: convertEgpToUsd(getExpectedPlanAmount(plan, normalizeBillingInterval(tenant.subscriptionInterval))),
      localAmountEgp: getExpectedPlanAmount(plan, normalizeBillingInterval(tenant.subscriptionInterval)),
      baseCurrency: "USD",
      localCurrency: "EGP",
      usdExchangeRate: getUsdExchangeRate(),
      interval: normalizeBillingInterval(tenant.subscriptionInterval),
      instructions: getManualPaymentInstructions(),
      methods: [] as Array<{
        method: "instapay" | "vodafone_cash";
        accountNumber: string;
        accountName: string;
        instructionsAr: string;
      }>,
    },
  };
}

function getPlanDetailsFromSubscription(subscription: Stripe.Subscription): {
  plan: BillingPlan;
  interval: BillingInterval | null;
} {
  const item = subscription.items.data[0];
  const priceId = item?.price?.id;
  const resolved = priceId ? getPlanFromPriceId(priceId) : null;

  return {
    plan: resolved?.plan ?? "basic",
    interval: resolved?.interval ?? null,
  };
}

async function upsertSubscriptionState(subscription: Stripe.Subscription): Promise<void> {
  const { plan, interval } = getPlanDetailsFromSubscription(subscription);
  const currentPeriodEnd =
    subscription.items.data[0]?.current_period_end ?? subscription.cancel_at ?? subscription.ended_at;

  await setTenantBillingByStripeIds({
    customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    subscriptionId: subscription.id,
    updates: {
      stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
      stripeSubscriptionId: subscription.id,
      currentPlan: plan,
      subscriptionInterval: interval,
      billingStatus: normalizeStatus(subscription.status),
      subscriptionEndsAt: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      lastInvoiceStatus: subscription.status,
    },
  });
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) {
    return undefined;
  }

  return typeof subscription === "string" ? subscription : subscription.id;
}

async function claimWebhookEvent(event: Stripe.Event, tenantId?: number | null): Promise<boolean> {
  const inserted = await db
    .insert(billingEventsTable)
    .values({
      tenantId: tenantId ?? null,
      stripeEventId: event.id,
      type: event.type,
      payload: JSON.stringify(event),
    })
    .onConflictDoNothing({ target: billingEventsTable.stripeEventId })
    .returning({ id: billingEventsTable.id });

  return inserted.length > 0;
}

async function releaseWebhookClaim(eventId: string): Promise<void> {
  await db.delete(billingEventsTable).where(eq(billingEventsTable.stripeEventId, eventId));
}

async function getTenantSubscriptionPayment(tenantId: number): Promise<{ amount: number | null; baseCurrency: "USD" | "EGP" }> {
  const [subscription] = await db
    .select({
      amount: tenantSubscriptionsTable.amount,
      currency: planPricesTable.currency,
    })
    .from(tenantSubscriptionsTable)
    .leftJoin(planPricesTable, eq(planPricesTable.id, tenantSubscriptionsTable.planPriceId))
    .where(eq(tenantSubscriptionsTable.tenantId, tenantId));

  return {
    amount: subscription?.amount ?? null,
    baseCurrency: String(subscription?.currency || "").toUpperCase() === "USD" ? "USD" : "EGP",
  };
}

async function getExpectedManualPaymentAmount(tenantId: number, tenant: { currentPlan: string | null; subscriptionInterval: string | null }): Promise<number> {
  const subscriptionPayment = await getTenantSubscriptionPayment(tenantId);
  const baseAmount = subscriptionPayment.amount
    ?? getExpectedPlanAmount(normalizePlan(tenant.currentPlan), normalizeBillingInterval(tenant.subscriptionInterval));

  return subscriptionPayment.baseCurrency === "USD" ? convertUsdToEgp(baseAmount) : baseAmount;
}

router.get("/billing/subscription", requireAuth, requireTenantAdmin, async (req, res): Promise<void> => {
  const tenant = await getTenantBilling(req.user!.tenantId);
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  const usage = await getTenantUsage(tenant.id);
  const paymentMethods = await paymentMethodsService.listBillingVisiblePaymentMethods(tenant.id);
  const snapshot = getSubscriptionSnapshotArgs(tenant, usage);
  const subscriptionPayment = await getTenantSubscriptionPayment(tenant.id);
  const effectiveAmount = subscriptionPayment.amount ?? snapshot.manualPayment.localAmountEgp;
  snapshot.manualPayment.baseCurrency = subscriptionPayment.baseCurrency;
  snapshot.manualPayment.amount = effectiveAmount;
  snapshot.manualPayment.amountUsd = subscriptionPayment.baseCurrency === "USD" ? effectiveAmount : convertEgpToUsd(effectiveAmount);
  snapshot.manualPayment.localAmountEgp = subscriptionPayment.baseCurrency === "USD" ? convertUsdToEgp(effectiveAmount) : effectiveAmount;
  snapshot.manualPayment.methods = paymentMethods.map((method) => ({
    method: method.code,
    accountNumber: method.account_number,
    accountName: method.account_name,
    instructionsAr: method.instructions_ar,
  }));
  res.json(GetBillingSubscriptionResponse.parse({
    ...snapshot,
    statusSummary: buildSubscriptionStatusSummary({
      billingStatus: snapshot.billingStatus,
      lastInvoiceStatus: snapshot.lastInvoiceStatus,
      isActive: snapshot.isActive,
      subscriptionEndsAt: tenant.subscriptionEndsAt,
      trialEndsAt: tenant.trialEndsAt,
    }),
  }));
});

router.get("/billing/payment-methods", requireAuth, requireTenantAdmin, async (req, res): Promise<void> => {
  const methods = await paymentMethodsService.listBillingVisiblePaymentMethods(req.user!.tenantId);
  res.json(methods);
});

router.get("/billing/payment-methods/qr", requireAuth, requireTenantAdmin, async (req, res): Promise<void> => {
  const tenant = await getTenantBilling(req.user!.tenantId);
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  const method = String(req.query.method || "") as "instapay" | "vodafone_cash";
  if (!["instapay", "vodafone_cash"].includes(method)) {
    res.status(400).json({ error: "Invalid payment method" });
    return;
  }

  const methods = await paymentMethodsService.listBillingVisiblePaymentMethods(req.user!.tenantId);
  const selectedMethod = methods.find((item) => item.code === method);
  if (!selectedMethod) {
    res.status(404).json({ error: "Payment method is not active for this tenant" });
    return;
  }

  const requestedAmount = Number(req.query.amount || 0);
  const subscriptionPayment = await getTenantSubscriptionPayment(tenant.id);
  const fallbackAmountEgp = subscriptionPayment.baseCurrency === "USD"
    ? convertUsdToEgp(subscriptionPayment.amount ?? 0)
    : subscriptionPayment.amount;
  const amount = Number.isFinite(requestedAmount) && requestedAmount > 0
    ? requestedAmount
    : fallbackAmountEgp ?? getExpectedPlanAmount(normalizePlan(tenant.currentPlan), normalizeBillingInterval(tenant.subscriptionInterval));

  const qr = await generatePaymentQr({
    method,
    accountNumber: selectedMethod.account_number,
    accountName: selectedMethod.account_name,
    amount,
  });

  res.setHeader("Cache-Control", "private, max-age=300");
  res.json({
    method,
    amount,
    amountUsd: convertEgpToUsd(amount),
    currency: "EGP",
    usdCurrency: "USD",
    usdExchangeRate: getUsdExchangeRate(),
    accountNumber: selectedMethod.account_number,
    accountName: selectedMethod.account_name,
    instructionsAr: selectedMethod.instructions_ar,
    qrImageDataUrl: qr.dataUrl,
    qrPayload: qr.payload,
    cached: qr.cached,
  });
});

router.post("/billing/pay", requireAuth, requireTenantAdmin, upload.single("proof_image"), async (req, res): Promise<void> => {
  const tenant = await getTenantBilling(req.user!.tenantId);
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  const method = String(req.body.method || "");
  const amount = Number(req.body.amount || 0);
  const referenceNumber = String(req.body.reference_number || "").trim();
  const proofImage = req.file;

  if (!["instapay", "vodafone_cash"].includes(method)) {
    res.status(400).json({ error: "Invalid payment method" });
    return;
  }

  if (!referenceNumber) {
    res.status(400).json({ error: "Reference number is required" });
    return;
  }

  if (!proofImage) {
    res.status(400).json({ error: "Proof image is required" });
    return;
  }

  const expectedAmount = await getExpectedManualPaymentAmount(tenant.id, tenant);
  if (amount !== expectedAmount) {
    res.status(400).json({ error: `Expected amount is ${expectedAmount}` });
    return;
  }

  const paymentMethods = await paymentMethodsService.listBillingVisiblePaymentMethods(tenant.id);
  const activeMethod = paymentMethods.find((item) => item.code === method);

  if (!activeMethod) {
    res.status(400).json({ error: "Selected payment method is not active for this tenant" });
    return;
  }

  const [existingPending] = await db.select().from(paymentsTable).where(
    and(
      eq(paymentsTable.tenantId, tenant.id),
      eq(paymentsTable.status, "pending"),
    ),
  );

  if (existingPending) {
    res.status(409).json({ error: "There is already a pending payment under review" });
    return;
  }

  const { proofImageUrl } = await savePaymentProof({
    tenantId: tenant.id,
    originalName: proofImage.originalname,
    mimeType: proofImage.mimetype,
    buffer: proofImage.buffer,
  });

  const [payment] = await db.insert(paymentsTable).values({
    tenantId: tenant.id,
    amount,
    method,
    status: "pending",
    referenceNumber,
    proofImageUrl,
    createdBy: req.user!.userId,
  }).returning();

  res.status(201).json({
    id: payment.id,
    status: payment.status,
    proofImageUrl: payment.proofImageUrl,
    createdAt: payment.createdAt.toISOString(),
  });
});

router.get("/billing/payments", requireAuth, requireTenantAdmin, async (req, res): Promise<void> => {
  const rows = await db.select({
    id: paymentsTable.id,
    amount: paymentsTable.amount,
    method: paymentsTable.method,
    status: paymentsTable.status,
    referenceNumber: paymentsTable.referenceNumber,
    proofImageUrl: paymentsTable.proofImageUrl,
    reviewedAt: paymentsTable.reviewedAt,
    createdAt: paymentsTable.createdAt,
    reviewerName: platformAdminsTable.fullName,
  }).from(paymentsTable)
    .leftJoin(platformAdminsTable, eq(paymentsTable.reviewedBy, platformAdminsTable.id))
    .where(eq(paymentsTable.tenantId, req.user!.tenantId))
    .orderBy(desc(paymentsTable.createdAt));

  res.json(rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    method: row.method,
    status: row.status,
    referenceNumber: row.referenceNumber,
    proofImageUrl: row.proofImageUrl,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    reviewerName: row.reviewerName ?? null,
  })));
});

router.get("/billing/invoices", requireAuth, requireTenantAdmin, async (req, res): Promise<void> => {
  const rows = await db.select({
    id: invoicesTable.id,
    invoiceNumber: invoicesTable.invoiceNumber,
    amount: invoicesTable.amount,
    currency: invoicesTable.currency,
    status: invoicesTable.status,
    issuedAt: invoicesTable.issuedAt,
    dueAt: invoicesTable.dueAt,
    paidAt: invoicesTable.paidAt,
    notes: invoicesTable.notes,
  }).from(invoicesTable)
    .where(eq(invoicesTable.tenantId, req.user!.tenantId))
    .orderBy(desc(invoicesTable.issuedAt));

  res.json(rows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    issuedAt: row.issuedAt.toISOString(),
    dueAt: row.dueAt?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    notes: row.notes ?? null,
  })));
});

router.get("/admin/payments", requireAuth, requireAdminPermission("billing.read"), async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const method = typeof req.query.method === "string" ? req.query.method : "";
  const conditions = [];
  if (status) {
    conditions.push(eq(paymentsTable.status, status));
  }
  if (method === "instapay" || method === "vodafone_cash") {
    conditions.push(eq(paymentsTable.method, method));
  }
  const rows = await db.select({
    id: paymentsTable.id,
    tenantId: paymentsTable.tenantId,
    tenantName: tenantsTable.name,
    amount: paymentsTable.amount,
    method: paymentsTable.method,
    status: paymentsTable.status,
    referenceNumber: paymentsTable.referenceNumber,
    proofImageUrl: paymentsTable.proofImageUrl,
    createdAt: paymentsTable.createdAt,
    reviewedAt: paymentsTable.reviewedAt,
    createdByName: usersTable.fullName,
    reviewerName: platformAdminsTable.fullName,
  }).from(paymentsTable)
    .innerJoin(tenantsTable, eq(paymentsTable.tenantId, tenantsTable.id))
    .innerJoin(usersTable, eq(paymentsTable.createdBy, usersTable.id))
    .leftJoin(platformAdminsTable, eq(paymentsTable.reviewedBy, platformAdminsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(paymentsTable.createdAt));

  await writeAdminAuditLog({
    req,
    action: "ADMIN_PAYMENTS_VIEWED",
    entityType: "payment",
    metadata: { status: status || null, method: method || null },
  });

  res.json(rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    amount: row.amount,
    method: row.method,
    status: row.status,
    referenceNumber: row.referenceNumber,
    proofImageUrl: row.proofImageUrl,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdByName: row.createdByName,
    reviewerName: row.reviewerName ?? null,
  })));
});

router.get("/admin/payments/:id/proof", requireAuth, requireAdminPermission("billing.read"), async (req, res): Promise<void> => {
  const paymentId = Number(req.params.id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    res.status(400).json({ error: "Invalid payment id" });
    return;
  }

  const [payment] = await db
    .select({ proofImageUrl: paymentsTable.proofImageUrl })
    .from(paymentsTable)
    .where(eq(paymentsTable.id, paymentId));

  if (!payment?.proofImageUrl) {
    res.status(404).json({ error: "Proof image not found" });
    return;
  }

  try {
    const { stream, contentType } = await getPaymentProof({ proofImageUrl: payment.proofImageUrl });
    res.setHeader("Content-Type", contentType);
    stream.pipe(res);
  } catch {
    res.status(404).json({ error: "Proof image not found" });
  }
});

async function reviewPayment({
  paymentId,
  reviewerId,
  status,
}: {
  paymentId: number;
  reviewerId: number | null;
  status: "approved" | "rejected" | "pending_review";
}) {
  const [payment] = await db.update(paymentsTable)
    .set({
      status,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    })
    .where(and(eq(paymentsTable.id, paymentId), eq(paymentsTable.status, "pending")))
    .returning();

  return payment;
}

router.patch("/admin/payments/:id/approve", requireAuth, requireAdminPermission("billing.write"), async (req, res): Promise<void> => {
  const paymentId = Number(req.params.id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    res.status(400).json({ error: "Invalid payment id" });
    return;
  }

  const payment = await reviewPayment({
    paymentId,
    reviewerId: req.user!.userId > 0 ? req.user!.userId : null,
    status: "approved",
  });
  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  await db.update(tenantsTable)
    .set({
      billingStatus: "active",
      isActive: true,
      subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastInvoiceStatus: "manual_payment_approved",
    })
    .where(eq(tenantsTable.id, payment.tenantId));

  await writeAdminAuditLog({
    req,
    action: "PAYMENT_APPROVED",
    entityType: "payment",
    entityId: payment.id,
    targetTenantId: payment.tenantId,
    metadata: { amount: payment.amount, method: payment.method },
  });

  res.json({ id: payment.id, status: payment.status });
});

router.patch("/admin/payments/:id/review", requireAuth, requireAdminPermission("billing.write"), async (req, res): Promise<void> => {
  const paymentId = Number(req.params.id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    res.status(400).json({ error: "Invalid payment id" });
    return;
  }

  const payment = await reviewPayment({
    paymentId,
    reviewerId: req.user!.userId > 0 ? req.user!.userId : null,
    status: "pending_review",
  });
  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  await db.update(tenantsTable)
    .set({
      lastInvoiceStatus: "manual_payment_pending_review",
    })
    .where(eq(tenantsTable.id, payment.tenantId));

  await writeAdminAuditLog({
    req,
    action: "PAYMENT_MARKED_PENDING_REVIEW",
    entityType: "payment",
    entityId: payment.id,
    targetTenantId: payment.tenantId,
    metadata: { amount: payment.amount, method: payment.method },
  });

  res.json({ id: payment.id, status: payment.status });
});

router.patch("/admin/payments/:id/reject", requireAuth, requireAdminPermission("billing.write"), async (req, res): Promise<void> => {
  const paymentId = Number(req.params.id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    res.status(400).json({ error: "Invalid payment id" });
    return;
  }

  const payment = await reviewPayment({
    paymentId,
    reviewerId: req.user!.userId > 0 ? req.user!.userId : null,
    status: "rejected",
  });
  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  await db.update(tenantsTable)
    .set({
      lastInvoiceStatus: "manual_payment_rejected",
    })
    .where(eq(tenantsTable.id, payment.tenantId));

  await writeAdminAuditLog({
    req,
    action: "PAYMENT_REJECTED",
    entityType: "payment",
    entityId: payment.id,
    targetTenantId: payment.tenantId,
    severity: "warning",
    metadata: { amount: payment.amount, method: payment.method },
  });

  res.json({ id: payment.id, status: payment.status });
});

router.post("/billing/checkout-session", requireAuth, requireTenantAdmin, async (req, res): Promise<void> => {
  if (!requireStripe(res)) {
    return;
  }

  const parsed = CreateBillingCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { plan, interval = "monthly" } = parsed.data;

  if (plan === "enterprise") {
    res.status(400).json({
      error: "Enterprise plan requires contacting sales",
      contactEmail: "sales@example.com",
    });
    return;
  }

  const priceId = resolvePriceId(plan, interval);
  if (!priceId) {
    res.status(500).json({ error: "Selected billing price is not configured" });
    return;
  }

  try {
    const { tenant, customerId } = await ensureStripeCustomer(req.user!.tenantId);
    const trialDays = !tenant.stripeSubscriptionId ? getTrialDays(tenant.trialEndsAt) : undefined;
    const appUrl = getAppUrl();

    const session = await stripe!.checkout.sessions.create({
      mode: "subscription",
      success_url: `${appUrl}/billing?checkout=success`,
      cancel_url: `${appUrl}/billing?checkout=canceled`,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: {
        tenantId: String(tenant.id),
        selectedPlan: plan,
        selectedInterval: interval,
      },
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          tenantId: String(tenant.id),
          selectedPlan: plan,
          selectedInterval: interval,
        },
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    logger.error({ err: error, tenantId: req.user!.tenantId }, "Failed to create Stripe checkout session");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/billing/customer-portal", requireAuth, requireTenantAdmin, async (req, res): Promise<void> => {
  if (!requireStripe(res)) {
    return;
  }

  try {
    const { customerId } = await ensureStripeCustomer(req.user!.tenantId);
    const session = await stripe!.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppUrl()}/billing`,
    });

    res.json({ url: session.url });
  } catch (error) {
    logger.error({ err: error, tenantId: req.user!.tenantId }, "Failed to create customer portal session");
    res.status(500).json({ error: "Failed to create customer portal session" });
  }
});

router.post("/billing/webhook", async (req, res): Promise<void> => {
  if (!requireStripe(res)) {
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    res.status(400).json({ error: "Missing Stripe signature" });
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(500).json({ error: "Stripe webhook secret is not configured" });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? "");

  let event: Stripe.Event;
  try {
    event = stripe!.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    logger.warn({ err: error }, "Invalid Stripe webhook signature");
    res.status(400).json({ error: "Invalid Stripe signature" });
    return;
  }

  try {
    const stripeTenantId = Number((event.data.object as { metadata?: Record<string, string> }).metadata?.tenantId || "0") || null;

    const claimed = await claimWebhookEvent(event, stripeTenantId);
    if (!claimed) {
      res.json({ received: true, duplicate: true });
      return;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = Number(session.metadata?.tenantId || "0");
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (tenantId) {
          await db
            .update(tenantsTable)
            .set({
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              currentPlan: normalizePlan(session.metadata?.selectedPlan),
              subscriptionInterval: session.metadata?.selectedInterval === "yearly" ? "yearly" : "monthly",
            })
            .where(
              and(
                eq(tenantsTable.id, tenantId),
                or(isNull(tenantsTable.stripeCustomerId), eq(tenantsTable.stripeCustomerId, customerId ?? "")),
              ),
            );
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await upsertSubscriptionState(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await setTenantBillingByStripeIds({
          customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
          subscriptionId: subscription.id,
          updates: {
            billingStatus: "canceled",
            subscriptionEndsAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : new Date(),
            lastInvoiceStatus: "canceled",
          },
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await setTenantBillingByStripeIds({
          customerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
          subscriptionId: getInvoiceSubscriptionId(invoice),
          updates: {
            billingStatus: "active",
            lastInvoiceStatus: "paid",
          },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await setTenantBillingByStripeIds({
          customerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
          subscriptionId: getInvoiceSubscriptionId(invoice),
          updates: {
            billingStatus: "past_due",
            lastInvoiceStatus: "payment_failed",
          },
        });
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    await releaseWebhookClaim(event.id).catch((releaseError) => {
      logger.error({ err: releaseError, eventId: event.id }, "Failed to release Stripe webhook claim");
    });
    logger.error({ err: error, eventId: event.id, eventType: event.type }, "Failed to process Stripe webhook");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
