import { z } from "zod/v4";

export const USER_ROLES = ["admin", "production", "qc", "warehouse", "sales"] as const;
export const PLATFORM_ADMIN_ROLES = ["super_admin", "support_admin", "billing_admin", "security_admin", "readonly_admin"] as const;
export const BILLING_STATUSES = ["trialing", "active", "past_due", "unpaid", "incomplete", "canceled"] as const;
export const SUBSCRIPTION_INTERVALS = ["monthly", "yearly"] as const;
export const PAYMENT_STATUSES = ["pending", "approved", "rejected", "pending_review"] as const;
export const PAYMENT_METHODS = ["instapay", "vodafone_cash"] as const;
export const PLAN_PRICE_INTERVALS = ["monthly", "yearly"] as const;
export const SUPPORTED_CURRENCIES = ["EGP", "USD"] as const;

export const userRoleSchema = z.enum(USER_ROLES);
export const billingStatusSchema = z.enum(BILLING_STATUSES);
export const subscriptionIntervalSchema = z.enum(SUBSCRIPTION_INTERVALS);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const planPriceIntervalSchema = z.enum(PLAN_PRICE_INTERVALS);
export const supportedCurrencySchema = z.enum(SUPPORTED_CURRENCIES);

/**
 * Safe DB-facing domain constants only.
 * Intentionally excludes dynamic values like currentPlan because those are
 * user-configurable/business-configurable and constraining them here could be
 * risky in production without a staged migration.
 */
