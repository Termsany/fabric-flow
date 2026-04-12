type StatusSummary = {
  state: "active" | "trialing" | "scheduled_cancel" | "past_due" | "unpaid" | "incomplete" | "canceled";
  severity: "success" | "info" | "warning" | "danger";
  hasAccess: boolean;
  needsAttention: boolean;
  isEndingSoon: boolean;
  nextRelevantAt: string | null;
  nextRelevantType: "trial_end" | "renewal" | "cancellation" | null;
  lastInvoiceStatus: string | null;
};

type SubscriptionStatusTranslations = {
  trialEndsAt: string;
  renewsAt: string;
  subscriptionEndsAt: string;
  subscriptionStateActive: string;
  subscriptionStateTrialing: string;
  subscriptionStateScheduledCancel: string;
  subscriptionStatePastDue: string;
  subscriptionStateUnpaid: string;
  subscriptionStateIncomplete: string;
  subscriptionStateCanceled: string;
  subscriptionSummaryActive: string;
  subscriptionSummaryTrialing: string;
  subscriptionSummaryTrialEndingSoon: string;
  subscriptionSummaryScheduledCancel: string;
  subscriptionSummaryCancellationSoon: string;
  subscriptionSummaryPastDue: string;
  subscriptionSummaryUnpaid: string;
  subscriptionSummaryIncomplete: string;
  subscriptionSummaryCanceled: string;
};

export function getSubscriptionStatusTone(summary: StatusSummary): string {
  if (summary.severity === "success") return "bg-emerald-100 text-emerald-700";
  if (summary.severity === "info") return "bg-sky-100 text-sky-700";
  if (summary.severity === "warning") return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-700";
}

export function getSubscriptionStatusLabel(
  summary: StatusSummary,
  t: SubscriptionStatusTranslations,
): string {
  const labels: Record<StatusSummary["state"], string> = {
    active: t.subscriptionStateActive,
    trialing: t.subscriptionStateTrialing,
    scheduled_cancel: t.subscriptionStateScheduledCancel,
    past_due: t.subscriptionStatePastDue,
    unpaid: t.subscriptionStateUnpaid,
    incomplete: t.subscriptionStateIncomplete,
    canceled: t.subscriptionStateCanceled,
  };

  return labels[summary.state];
}

export function getSubscriptionStatusMessage(
  summary: StatusSummary,
  t: SubscriptionStatusTranslations,
): string {
  const messages: Record<StatusSummary["state"], string> = {
    active: t.subscriptionSummaryActive,
    trialing: summary.isEndingSoon ? t.subscriptionSummaryTrialEndingSoon : t.subscriptionSummaryTrialing,
    scheduled_cancel: summary.isEndingSoon ? t.subscriptionSummaryCancellationSoon : t.subscriptionSummaryScheduledCancel,
    past_due: t.subscriptionSummaryPastDue,
    unpaid: t.subscriptionSummaryUnpaid,
    incomplete: t.subscriptionSummaryIncomplete,
    canceled: t.subscriptionSummaryCanceled,
  };

  return messages[summary.state];
}

export function getSubscriptionNextEventLabel(
  summary: StatusSummary,
  t: SubscriptionStatusTranslations,
): string | null {
  if (summary.nextRelevantType === "trial_end") return t.trialEndsAt;
  if (summary.nextRelevantType === "renewal") return t.renewsAt;
  if (summary.nextRelevantType === "cancellation") return t.subscriptionEndsAt;
  return null;
}
