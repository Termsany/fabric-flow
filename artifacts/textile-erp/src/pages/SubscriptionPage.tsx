import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useLang } from "@/contexts/LangContext";
import { useCancelSubscription, useChangeSubscriptionPlan, useCurrentSubscription, usePublicPlans, useSubscribePlan } from "@/hooks/use-plans";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { PaymentMethodCode } from "@/lib/payment-methods";
import {
  getSubscriptionNextEventLabel,
  getSubscriptionStatusLabel,
  getSubscriptionStatusMessage,
  getSubscriptionStatusTone,
} from "@/lib/subscription-status";

export function SubscriptionPage() {
  const { t, lang } = useLang();
  const { data, isLoading, error, refetch } = useCurrentSubscription();
  const {
    data: publicPlans = [],
    isLoading: arePlansLoading,
    error: plansError,
  } = usePublicPlans();
  const subscribeMutation = useSubscribePlan();
  const changeMutation = useChangeSubscriptionPlan();
  const cancelMutation = useCancelSubscription();
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "yearly">("monthly");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodCode | "">("");

  const currentPlanCode = data?.subscription.plan.code;
  const availablePlans = useMemo(() => publicPlans.filter((plan) => plan.isActive), [publicPlans]);
  const currentAppliedAmount = data?.subscription.amount ?? null;
  const currentAppliedAmountEgp = data
    ? (data.subscription.baseCurrency === "USD" ? data.subscription.amountEgp : data.subscription.amount) ?? null
    : null;
  const isMutating = subscribeMutation.isPending || changeMutation.isPending || cancelMutation.isPending;
  const getErrorMessage = (value: unknown) => (value instanceof Error ? value.message : t.failedToLoadData);

  const handleSelectPlan = async (planCode: string) => {
    const payload = {
      planCode,
      interval: selectedInterval,
      paymentMethodCode: selectedPaymentMethod || undefined,
    };

    try {
      if (currentPlanCode) {
        await changeMutation.mutateAsync(payload);
      } else {
        await subscribeMutation.mutateAsync(payload);
      }
      toast({ title: t.saveChanges, description: t.planUpdated });
    } catch (mutationError) {
      toast({ title: t.billing, description: getErrorMessage(mutationError) });
    }
  };

  return (
    <Layout>
      <PageHeader
        title={t.billing}
        subtitle={t.subscriptionInfo}
        action={<button type="button" onClick={() => void refetch()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">{t.refresh}</button>}
      />

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr,1.5fr]"><div className="h-72 animate-pulse rounded-3xl bg-slate-200" /><div className="h-72 animate-pulse rounded-3xl bg-slate-200" /></div>
      ) : error || !data ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error instanceof Error ? error.message : t.failedToLoadData}</div>
      ) : (
        <>
          <div className="mb-6 grid gap-6 lg:grid-cols-[1.1fr,1.5fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-slate-500">{t.currentPlan}</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{lang === "ar" ? data.subscription.plan.nameAr : data.subscription.plan.nameEn}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getSubscriptionStatusTone(data.subscription.statusSummary)}`}>
                  {getSubscriptionStatusLabel(data.subscription.statusSummary, t)}
                </span>
                <span className="text-sm text-slate-600">{getSubscriptionStatusMessage(data.subscription.statusSummary, t)}</span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div><div className="text-xs text-slate-500">{t.subscriptionStatus}</div><div className="mt-1 font-medium text-slate-900">{getSubscriptionStatusLabel(data.subscription.statusSummary, t)}</div></div>
                <div><div className="text-xs text-slate-500">{getSubscriptionNextEventLabel(data.subscription.statusSummary, t) || t.renewalDate}</div><div className="mt-1 font-medium text-slate-900">{data.subscription.statusSummary.nextRelevantAt ? formatDateTime(data.subscription.statusSummary.nextRelevantAt, lang) : "-"}</div></div>
                <div>
                  <div className="text-xs text-slate-500">{t.amount}</div>
                  <div className="mt-1 font-medium text-slate-900">
                    {data.subscription.amount != null ? formatCurrency(data.subscription.amount, data.subscription.baseCurrency, lang) : "-"}
                  </div>
                  {(data.subscription.amountUsd != null || data.subscription.amountEgp != null) ? (
                    <div className="mt-1 text-xs text-slate-500">
                      {data.subscription.baseCurrency === "USD"
                        ? formatCurrency(data.subscription.amountEgp ?? 0, data.subscription.egpCurrency, lang)
                        : formatCurrency(data.subscription.amountUsd ?? 0, data.subscription.usdCurrency, lang)}
                    </div>
                  ) : null}
                </div>
                <div><div className="text-xs text-slate-500">{t.paymentMethod}</div><div className="mt-1 font-medium text-slate-900">{data.subscription.paymentMethodCode || "-"}</div></div>
                <div><div className="text-xs text-slate-500">{t.createdAt}</div><div className="mt-1 font-medium text-slate-900">{formatDateTime(data.subscription.startedAt, lang)}</div></div>
                <div><div className="text-xs text-slate-500">{t.accessStatus}</div><div className="mt-1 font-medium text-slate-900">{data.subscription.statusSummary.hasAccess ? t.accessActive : t.accessRestricted}</div></div>
                <div><div className="text-xs text-slate-500">{t.lastInvoiceStatus}</div><div className="mt-1 font-medium text-slate-900">{data.subscription.statusSummary.lastInvoiceStatus || "-"}</div></div>
              </div>
              {(data.subscription.statusSummary.needsAttention || data.subscription.statusSummary.isEndingSoon) ? (
                <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  data.subscription.statusSummary.needsAttention
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}>
                  {getSubscriptionStatusMessage(data.subscription.statusSummary, t)}
                </div>
              ) : null}
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 text-sm font-medium text-slate-900">{t.planFeatures}</div>
                <div className="space-y-2 text-sm text-slate-600">
                  {data.subscription.plan.features.filter((feature) => feature.included).map((feature) => (
                    <div key={feature.id}>{lang === "ar" ? feature.labelAr : feature.labelEn}</div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {plansError ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {plansError instanceof Error ? plansError.message : t.billingActivityLoadError}
                </div>
              ) : null}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setSelectedInterval("monthly")} className={`rounded-xl px-4 py-2 text-sm font-medium ${selectedInterval === "monthly" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{t.monthly}</button>
                <button type="button" onClick={() => setSelectedInterval("yearly")} className={`rounded-xl px-4 py-2 text-sm font-medium ${selectedInterval === "yearly" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{t.yearly}</button>
                  <select value={selectedPaymentMethod} disabled={isMutating} onChange={(e) => setSelectedPaymentMethod(e.target.value as PaymentMethodCode | "")} className="min-w-52 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 disabled:opacity-60">
                  <option value="">{t.choosePaymentMethod}</option>
                  {data.paymentMethods.map((method) => (
                    <option key={method.code} value={method.code}>{lang === "ar" ? method.name_ar : method.name_en}</option>
                  ))}
                </select>
              </div>

              {arePlansLoading ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="h-72 animate-pulse rounded-3xl bg-slate-100" />
                  <div className="h-72 animate-pulse rounded-3xl bg-slate-100" />
                  <div className="h-72 animate-pulse rounded-3xl bg-slate-100" />
                </div>
              ) : availablePlans.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  {t.noBillingPlansAvailable}
                </div>
              ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {availablePlans.map((plan) => {
                  const price = plan.prices.find((item) => item.interval === selectedInterval);
                  const isCurrent = currentPlanCode === plan.code;
                  const displayAmount = isCurrent && data.subscription.amount != null
                    ? data.subscription.amount
                    : price?.amount;
                  const displayAmountEgp = displayAmount != null && price
                    ? ((isCurrent ? data.subscription.baseCurrency : price.baseCurrency) === "USD"
                        ? (isCurrent ? data.subscription.amountEgp : price.egpAmount)
                        : displayAmount)
                    : null;
                  const difference = currentAppliedAmountEgp != null && displayAmountEgp != null ? displayAmountEgp - currentAppliedAmountEgp : null;
                  return (
                    <article key={plan.id} className={`rounded-3xl border p-5 ${isCurrent ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white"}`}>
                      <div className="text-lg font-semibold text-slate-900">{lang === "ar" ? plan.nameAr : plan.nameEn}</div>
                      <div className="mt-2 text-sm text-slate-500">{lang === "ar" ? plan.descriptionAr : plan.descriptionEn}</div>
                      <div className="mt-4 text-3xl font-bold text-slate-900">
                        {displayAmount != null && price ? formatCurrency(displayAmount, isCurrent ? data.subscription.baseCurrency : price.baseCurrency, lang) : "-"}
                      </div>
                      {displayAmount != null && price ? (
                        <div className="mt-1 text-xs text-slate-500">
                          {formatCurrency(
                            (isCurrent ? data.subscription.baseCurrency : price.baseCurrency) === "USD"
                              ? (isCurrent ? data.subscription.amountEgp ?? 0 : price.egpAmount)
                              : (isCurrent ? data.subscription.amountUsd ?? 0 : price.usdAmount),
                            (isCurrent ? data.subscription.baseCurrency : price.baseCurrency) === "USD" ? "EGP" : "USD",
                            lang,
                          )}
                        </div>
                      ) : null}
                      <div className="mt-1 text-xs text-slate-500">{selectedInterval === "monthly" ? t.monthly : t.yearly}</div>
                      <div className="mt-4 space-y-2 text-sm text-slate-600">
                        {plan.features.filter((feature) => feature.included).slice(0, 4).map((feature) => (
                          <div key={feature.id}>{lang === "ar" ? feature.labelAr : feature.labelEn}</div>
                        ))}
                      </div>
                      {!isCurrent && difference != null ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                          <div className="font-medium text-slate-900">{t.planChangePreview}</div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span>{t.currentAppliedPrice}</span>
                            <span>{formatCurrency(currentAppliedAmount ?? 0, data.subscription.baseCurrency, lang)}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                            <span>{t.newPrice}</span>
                            <span>{displayAmount != null ? formatCurrency(displayAmount, price?.baseCurrency ?? data.subscription.baseCurrency, lang) : "-"}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                            <span>{t.priceDifference}</span>
                            <span className={difference > 0 ? "text-amber-700" : "text-emerald-700"}>
                              {difference === 0 ? t.noDifference : `${difference > 0 ? "+" : ""}${formatCurrency(Math.abs(difference), "EGP", lang)}`}
                            </span>
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-5 flex gap-2">
                        {isCurrent ? (
                          <button
                            type="button"
                            disabled={cancelMutation.isPending}
                            onClick={() => {
                              void cancelMutation.mutateAsync({ cancelAtPeriodEnd: true })
                                .then(() => toast({ title: t.billing, description: t.canceled }))
                                .catch((mutationError) => {
                                  toast({ title: t.billing, description: getErrorMessage(mutationError) });
                                });
                            }}
                            className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 disabled:opacity-60"
                          >
                            {cancelMutation.isPending ? t.subscriptionActionInProgress : t.cancel}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isMutating}
                            onClick={() => { void handleSelectPlan(plan.code); }}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {isMutating ? t.subscriptionActionInProgress : currentPlanCode ? t.changePlan : t.subscribe}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              )}
            </section>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 text-lg font-semibold text-slate-900">{t.invoiceHistory}</div>
            {data.history.length === 0 ? (
              <div className="text-sm text-slate-500">{t.subscriptionHistoryEmptyState}</div>
            ) : (
              <div className="space-y-3">
                {data.history.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-slate-900">{entry.action}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(entry.createdAt, lang)}</div>
                    </div>
                    {entry.notes ? <div className="mt-1 text-sm text-slate-600">{entry.notes}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}
