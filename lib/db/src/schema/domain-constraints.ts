import { z } from "zod/v4";

export const USER_ROLES = ["admin", "production", "qc", "warehouse", "sales"] as const;
export const PLATFORM_ADMIN_ROLES = ["super_admin", "support_admin", "billing_admin", "security_admin", "readonly_admin"] as const;
export const BILLING_STATUSES = ["trialing", "active", "past_due", "unpaid", "incomplete", "canceled"] as const;
export const SUBSCRIPTION_INTERVALS = ["monthly", "yearly"] as const;
export const PAYMENT_STATUSES = ["pending", "approved", "rejected", "pending_review"] as const;
export const PAYMENT_METHODS = ["instapay", "vodafone_cash"] as const;
export const PLAN_PRICE_INTERVALS = ["monthly", "yearly"] as const;
export const SUPPORTED_CURRENCIES = ["EGP", "USD"] as const;
export const PRODUCTION_ORDER_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const DYEING_ORDER_STATUSES = ["PENDING", "SENT", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const SALES_ORDER_STATUSES = ["DRAFT", "CONFIRMED", "INVOICED", "DELIVERED", "CANCELLED"] as const;
export const FABRIC_ROLL_STATUSES = [
  "CREATED",
  "IN_PRODUCTION",
  "QC_PENDING",
  "QC_PASSED",
  "QC_FAILED",
  "SENT_TO_DYEING",
  "IN_DYEING",
  "FINISHED",
  "IN_STOCK",
  "RESERVED",
  "SOLD",
] as const;
export const QC_RESULTS = ["PASS", "FAIL", "SECOND"] as const;
export const INVOICE_STATUSES = ["ISSUED", "PAID", "OVERDUE", "VOID"] as const;

export const userRoleSchema = z.enum(USER_ROLES);
export const platformAdminRoleSchema = z.enum(PLATFORM_ADMIN_ROLES);
export const billingStatusSchema = z.enum(BILLING_STATUSES);
export const subscriptionIntervalSchema = z.enum(SUBSCRIPTION_INTERVALS);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const planPriceIntervalSchema = z.enum(PLAN_PRICE_INTERVALS);
export const supportedCurrencySchema = z.enum(SUPPORTED_CURRENCIES);
export const productionOrderStatusSchema = z.enum(PRODUCTION_ORDER_STATUSES);
export const dyeingOrderStatusSchema = z.enum(DYEING_ORDER_STATUSES);
export const salesOrderStatusSchema = z.enum(SALES_ORDER_STATUSES);
export const fabricRollStatusSchema = z.enum(FABRIC_ROLL_STATUSES);
export const qcResultSchema = z.enum(QC_RESULTS);
export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);

/**
 * Safe DB-facing domain constants only.
 * Intentionally excludes dynamic values like currentPlan because those are
 * user-configurable/business-configurable and constraining them here could be
 * risky in production without a staged migration.
 */
