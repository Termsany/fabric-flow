import { apiClientRequest } from "@/lib/api-client";
import type { PaymentMethodCode, TenantPaymentMethodRecord } from "@/lib/payment-methods";

export interface PlanFeature {
  id: number;
  featureKey: string;
  labelAr: string;
  labelEn: string;
  included: boolean;
  sortOrder: number;
}

export interface PlanPrice {
  id: number;
  interval: "monthly" | "yearly";
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

export interface PlanRecord {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  isActive: boolean;
  sortOrder: number;
  subscribersCount: number;
  features: PlanFeature[];
  prices: PlanPrice[];
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRecord {
  id: number;
  tenantId: number;
  amount: number | null;
  amountUsd: number | null;
  amountEgp: number | null;
  baseCurrency: "EGP" | "USD";
  usdCurrency: "USD";
  egpCurrency: "EGP";
  usdExchangeRate: number;
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete";
  paymentProvider: string | null;
  paymentMethodCode: PaymentMethodCode | null;
  cancelAtPeriodEnd: boolean;
  startedAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  canceledAt: string | null;
  metadata: Record<string, unknown>;
  plan: PlanRecord;
}

export interface CurrentSubscriptionResponse {
  subscription: SubscriptionRecord;
  history: Array<{
    id: number;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    notes: string | null;
    createdAt: string;
  }>;
  paymentMethods: TenantPaymentMethodRecord[];
}

export interface PlanPriceUpdatePayload {
  interval: "monthly" | "yearly";
  amount: number;
  currency: string;
  trialDays?: number;
  localPaymentEnabled?: boolean;
  isActive?: boolean;
}

export interface PlanPriceApplyPayload {
  interval: "monthly" | "yearly";
  applyOnNextBilling?: boolean;
}

export interface PlanPriceApplySelectedPayload extends PlanPriceApplyPayload {
  tenantIds: number[];
}

export interface PlanPriceApplyResponse {
  planId: number;
  interval: "monthly" | "yearly";
  amount: number;
  updatedCount: number;
  tenantIds: number[];
}

export interface PlanUpsertPayload {
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
}

const plansFetch = apiClientRequest;

export const getAdminPlans = () => plansFetch<PlanRecord[]>("/api/admin/plans");
export const createAdminPlan = (payload: PlanUpsertPayload) => plansFetch<PlanRecord>("/api/admin/plans", { method: "POST", body: JSON.stringify(payload) });
export const updateAdminPlan = (id: number, payload: PlanUpsertPayload) => plansFetch<PlanRecord>(`/api/admin/plans/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const updateAdminPlanPrice = (id: number, payload: PlanPriceUpdatePayload) =>
  plansFetch<PlanRecord>(`/api/admin/plans/${id}/price`, { method: "PATCH", body: JSON.stringify(payload) });
export const applyAdminPlanPriceAll = (id: number, payload: PlanPriceApplyPayload) =>
  plansFetch<PlanPriceApplyResponse>(`/api/admin/plans/${id}/apply-price-all`, { method: "POST", body: JSON.stringify(payload) });
export const applyAdminPlanPriceSelected = (id: number, payload: PlanPriceApplySelectedPayload) =>
  plansFetch<PlanPriceApplyResponse>(`/api/admin/plans/${id}/apply-price-selected`, { method: "POST", body: JSON.stringify(payload) });
export const getPublicPlans = () => plansFetch<PlanRecord[]>("/api/plans/public");
export const getCurrentSubscription = () => plansFetch<CurrentSubscriptionResponse>("/api/billing/current-subscription");
export const subscribePlan = (payload: { planCode: string; interval: "monthly" | "yearly"; paymentMethodCode?: PaymentMethodCode | null }) =>
  plansFetch<SubscriptionRecord>("/api/billing/subscribe", { method: "POST", body: JSON.stringify(payload) });
export const changeSubscriptionPlan = (payload: { planCode: string; interval: "monthly" | "yearly"; paymentMethodCode?: PaymentMethodCode | null; notes?: string | null }) =>
  plansFetch<SubscriptionRecord>("/api/billing/change-plan", { method: "POST", body: JSON.stringify(payload) });
export const cancelSubscription = (payload: { cancelAtPeriodEnd: boolean; notes?: string | null }) =>
  plansFetch<SubscriptionRecord>("/api/billing/cancel-subscription", { method: "POST", body: JSON.stringify(payload) });
