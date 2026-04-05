import { z } from "zod";
import { PAYMENT_METHOD_CODES } from "./payment-methods.types";

export const paymentMethodCodeSchema = z.enum(PAYMENT_METHOD_CODES);

export const updateGlobalPaymentMethodSchema = z.object({
  name_ar: z.string().trim().min(1).max(100),
  name_en: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(50).default("manual"),
  is_globally_enabled: z.boolean(),
  supports_manual_review: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(999).default(0),
});

export const updateTenantPaymentMethodSchema = z.object({
  is_active: z.boolean(),
  account_number: z.string().trim().max(100).optional().default(""),
  account_name: z.string().trim().max(120).optional().default(""),
  instructions_ar: z.string().trim().max(1000).optional().default(""),
  instructions_en: z.string().trim().max(1000).optional().default(""),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export function formatZodError(error: z.ZodError) {
  const flattened = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(flattened).map(([key, value]) => [key, value?.filter(Boolean) ?? []]),
  );
}
