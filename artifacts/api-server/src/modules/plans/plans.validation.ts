import { z } from "zod";
import { PLAN_INTERVALS } from "./plans.types";

const trimmedString = z.string().trim();

export const planFeatureInputSchema = z.object({
  featureKey: trimmedString.min(1),
  labelAr: trimmedString.min(1),
  labelEn: trimmedString.min(1),
  included: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const planPriceInputSchema = z.object({
  interval: z.enum(PLAN_INTERVALS),
  currency: trimmedString.min(3).max(8).default("EGP"),
  amount: z.number().int().positive(),
  trialDays: z.number().int().min(0).max(365).default(0),
  stripePriceId: z.string().trim().max(255).nullable().optional(),
  localPaymentEnabled: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const planUpsertSchema = z.object({
  code: trimmedString.min(2).max(50).regex(/^[a-z0-9_-]+$/),
  nameAr: trimmedString.min(1).max(120),
  nameEn: trimmedString.min(1).max(120),
  descriptionAr: trimmedString.max(500).nullable().optional(),
  descriptionEn: trimmedString.max(500).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  prices: z.array(planPriceInputSchema).min(1),
  features: z.array(planFeatureInputSchema).default([]),
}).superRefine((value, ctx) => {
  const intervals = new Set<string>();
  for (const [index, price] of value.prices.entries()) {
    if (intervals.has(price.interval)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Interval must be unique",
        path: ["prices", index, "interval"],
      });
    }
    intervals.add(price.interval);
  }
});

export const subscribeSchema = z.object({
  planCode: trimmedString.min(1),
  interval: z.enum(PLAN_INTERVALS),
  paymentMethodCode: trimmedString.min(1).nullable().optional(),
});

export const changePlanSchema = subscribeSchema.extend({
  notes: trimmedString.max(500).nullable().optional(),
});

export const cancelSubscriptionSchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true),
  notes: trimmedString.max(500).nullable().optional(),
});

export const updatePlanPriceSchema = z.object({
  interval: z.enum(PLAN_INTERVALS),
  amount: z.number().int().positive(),
  currency: trimmedString.min(3).max(8).default("EGP"),
  trialDays: z.number().int().min(0).max(365).optional(),
  localPaymentEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const applyPlanPriceAllSchema = z.object({
  interval: z.enum(PLAN_INTERVALS),
  applyOnNextBilling: z.boolean().default(true),
});

export const applyPlanPriceSelectedSchema = z.object({
  interval: z.enum(PLAN_INTERVALS),
  tenantIds: z.array(z.number().int().positive()).min(1),
  applyOnNextBilling: z.boolean().default(true),
});
