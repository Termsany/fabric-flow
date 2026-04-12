import { isSubscriptionActive, type BillingStatus } from "./billing";

export type SubscriptionStatusState =
  | "active"
  | "trialing"
  | "scheduled_cancel"
  | "past_due"
  | "unpaid"
  | "incomplete"
  | "canceled";

export type SubscriptionStatusSeverity = "success" | "info" | "warning" | "danger";

export type SubscriptionStatusSummary = {
  state: SubscriptionStatusState;
  severity: SubscriptionStatusSeverity;
  hasAccess: boolean;
  needsAttention: boolean;
  isEndingSoon: boolean;
  nextRelevantAt: string | null;
  nextRelevantType: "trial_end" | "renewal" | "cancellation" | null;
  lastInvoiceStatus: string | null;
};

type BuildSubscriptionStatusSummaryInput = {
  billingStatus: BillingStatus;
  lastInvoiceStatus?: string | null;
  isActive?: boolean;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: Date | null;
  subscriptionEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
};

function toIsoString(value?: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function isWithinDays(value: Date | null | undefined, days: number): boolean {
  if (!value) {
    return false;
  }

  const diffMs = value.getTime() - Date.now();
  if (diffMs < 0) {
    return false;
  }

  return diffMs <= days * 24 * 60 * 60 * 1000;
}

export function buildSubscriptionStatusSummary(input: BuildSubscriptionStatusSummaryInput): SubscriptionStatusSummary {
  const hasAccess = input.isActive ?? isSubscriptionActive(input.billingStatus, input.subscriptionEndsAt ?? input.currentPeriodEnd ?? null);
  const relevantPeriodEnd = input.currentPeriodEnd ?? input.subscriptionEndsAt ?? null;

  if (
    input.billingStatus === "trialing"
  ) {
    const nextRelevantAt = input.trialEndsAt ?? relevantPeriodEnd;
    return {
      state: "trialing",
      severity: isWithinDays(nextRelevantAt, 7) ? "warning" : "info",
      hasAccess,
      needsAttention: false,
      isEndingSoon: isWithinDays(nextRelevantAt, 7),
      nextRelevantAt: toIsoString(nextRelevantAt),
      nextRelevantType: nextRelevantAt ? "trial_end" : null,
      lastInvoiceStatus: input.lastInvoiceStatus ?? null,
    };
  }

  if (
    input.billingStatus === "active" && input.cancelAtPeriodEnd
    || input.billingStatus === "canceled" && hasAccess && Boolean(relevantPeriodEnd)
  ) {
    return {
      state: "scheduled_cancel",
      severity: isWithinDays(relevantPeriodEnd, 7) ? "warning" : "info",
      hasAccess,
      needsAttention: false,
      isEndingSoon: isWithinDays(relevantPeriodEnd, 7),
      nextRelevantAt: toIsoString(relevantPeriodEnd),
      nextRelevantType: relevantPeriodEnd ? "cancellation" : null,
      lastInvoiceStatus: input.lastInvoiceStatus ?? null,
    };
  }

  if (input.billingStatus === "active") {
    return {
      state: "active",
      severity: "success",
      hasAccess,
      needsAttention: false,
      isEndingSoon: false,
      nextRelevantAt: toIsoString(relevantPeriodEnd),
      nextRelevantType: relevantPeriodEnd ? "renewal" : null,
      lastInvoiceStatus: input.lastInvoiceStatus ?? null,
    };
  }

  if (input.billingStatus === "past_due" || input.billingStatus === "unpaid" || input.billingStatus === "incomplete") {
    return {
      state: input.billingStatus,
      severity: "danger",
      hasAccess,
      needsAttention: true,
      isEndingSoon: false,
      nextRelevantAt: toIsoString(relevantPeriodEnd),
      nextRelevantType: null,
      lastInvoiceStatus: input.lastInvoiceStatus ?? null,
    };
  }

  return {
    state: "canceled",
    severity: "warning",
    hasAccess,
    needsAttention: !hasAccess,
    isEndingSoon: false,
    nextRelevantAt: toIsoString(relevantPeriodEnd),
    nextRelevantType: relevantPeriodEnd && hasAccess ? "cancellation" : null,
    lastInvoiceStatus: input.lastInvoiceStatus ?? null,
  };
}
