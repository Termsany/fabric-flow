export const PLAN_INTERVALS = ["monthly", "yearly"] as const;
export type PlanInterval = typeof PLAN_INTERVALS[number];

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled", "unpaid", "incomplete"] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];
export type SubscriptionStatusSummary = {
  state: "active" | "trialing" | "scheduled_cancel" | "past_due" | "unpaid" | "incomplete" | "canceled";
  severity: "success" | "info" | "warning" | "danger";
  hasAccess: boolean;
  needsAttention: boolean;
  isEndingSoon: boolean;
  nextRelevantAt: string | null;
  nextRelevantType: "trial_end" | "renewal" | "cancellation" | null;
  lastInvoiceStatus: string | null;
};

export interface PlanFeatureDto {
  id: number;
  featureKey: string;
  labelAr: string;
  labelEn: string;
  included: boolean;
  sortOrder: number;
}

export interface PlanPriceDto {
  id: number;
  interval: PlanInterval;
  currency: string;
  amount: number;
  usdAmount: number;
  egpAmount: number;
  baseCurrency: "EGP" | "USD";
  usdCurrency: "USD";
  egpCurrency: "EGP";
  usdExchangeRate: number;
  trialDays: number;
  stripePriceId: string | null;
  localPaymentEnabled: boolean;
  isActive: boolean;
}

export interface PlanDto {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  isActive: boolean;
  sortOrder: number;
  subscribersCount: number;
  features: PlanFeatureDto[];
  prices: PlanPriceDto[];
  createdAt: string;
  updatedAt: string;
}

export interface TenantSubscriptionDto {
  id: number;
  tenantId: number;
  amount: number | null;
  amountUsd: number | null;
  amountEgp: number | null;
  baseCurrency: "EGP" | "USD";
  usdCurrency: "USD";
  egpCurrency: "EGP";
  usdExchangeRate: number;
  status: SubscriptionStatus;
  paymentProvider: string | null;
  paymentMethodCode: string | null;
  cancelAtPeriodEnd: boolean;
  startedAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  canceledAt: string | null;
  metadata: Record<string, unknown>;
  statusSummary: SubscriptionStatusSummary;
  plan: PlanDto;
}
