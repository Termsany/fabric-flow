import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, BadgeCheck, Building2, CalendarClock, CreditCard, Download, Receipt, Sparkles, Users } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useLang } from "@/contexts/LangContext";
import {
  createBillingCheckoutSession,
  createBillingCustomerPortal,
  getBillingSubscription,
  listBillingInvoices,
  listManualPayments,
  type BillingSubscription,
  type BillingInvoice,
} from "@/lib/billing";
import { formatCurrency, formatNumber } from "@/lib/format";

function formatDate(value: string | null, locale: string): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function planLabel(plan: BillingSubscription["currentPlan"], lang: "ar" | "en"): string {
  const labels = {
    ar: {
      basic: "الأساسية",
      pro: "الاحترافية",
      enterprise: "الخطة المفتوحة",
    },
    en: {
      basic: "Basic",
      pro: "Pro",
      enterprise: "Open Plan",
    },
  };

  return labels[lang][plan];
}

function planRank(plan: BillingSubscription["currentPlan"]): number {
  if (plan === "enterprise") return 3;
  if (plan === "pro") return 2;
  return 1;
}

function invoiceStatusTone(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "PAID") return "bg-emerald-100 text-emerald-700";
  if (normalized === "OVERDUE") return "bg-rose-100 text-rose-700";
  if (normalized === "VOID") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

function paymentStatusTone(status: string) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  if (status === "pending_review") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
}

function paymentStatusLabel(status: "pending" | "approved" | "rejected" | "pending_review", t: ReturnType<typeof useLang>["t"]) {
  if (status === "approved") return t.approved;
  if (status === "rejected") return t.rejected;
  if (status === "pending_review") return t.pendingReview;
  return t.pending;
}

function paymentMethodLabel(method: "instapay" | "vodafone_cash", t: ReturnType<typeof useLang>["t"]) {
  return method === "instapay" ? t.instapay : t.vodafone_cash;
}

function getPrimaryAndSecondaryPrice(args: {
  amount: number;
  baseCurrency: "USD" | "EGP";
  amountUsd: number;
  amountEgp: number;
}) {
  if (args.baseCurrency === "USD") {
    return {
      primaryAmount: args.amount,
      primaryCurrency: "USD" as const,
      secondaryAmount: args.amountEgp,
      secondaryCurrency: "EGP" as const,
    };
  }

  return {
    primaryAmount: args.amount,
    primaryCurrency: "EGP" as const,
    secondaryAmount: args.amountUsd,
    secondaryCurrency: "USD" as const,
  };
}

function printInvoice(invoice: BillingInvoice, companyName: string, locale: string, title: string) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!printWindow) return;

  const issuedAt = formatDate(invoice.issuedAt, locale);
  const dueAt = formatDate(invoice.dueAt, locale);
  const paidAt = formatDate(invoice.paidAt, locale);

  printWindow.document.write(`
    <html lang="${locale.startsWith("ar") ? "ar" : "en"}" dir="${locale.startsWith("ar") ? "rtl" : "ltr"}">
      <head>
        <title>${title} ${invoice.invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
          .card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
          .row { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
          .row:last-child { border-bottom: 0; }
          .muted { color: #64748b; font-size: 12px; }
          .strong { font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>${title}</h1>
          <p class="muted">${companyName}</p>
          <div class="row"><span>Invoice #</span><span class="strong">${invoice.invoiceNumber}</span></div>
          <div class="row"><span>Amount</span><span class="strong">${invoice.amount} ${invoice.currency}</span></div>
          <div class="row"><span>Status</span><span>${invoice.status}</span></div>
          <div class="row"><span>Issued at</span><span>${issuedAt}</span></div>
          <div class="row"><span>Due at</span><span>${dueAt}</span></div>
          <div class="row"><span>Paid at</span><span>${paidAt}</span></div>
          <div class="row"><span>Notes</span><span>${invoice.notes ?? "-"}</span></div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export function BillingPage() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const cycle = useMemo<"monthly" | "yearly">(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("interval");
    return requested === "yearly" ? "yearly" : "monthly";
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["billing-subscription"],
    queryFn: getBillingSubscription,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["billing-payments"],
    queryFn: listManualPayments,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["billing-invoices"],
    queryFn: listBillingInvoices,
  });

  const checkout = useMutation({
    mutationFn: createBillingCheckoutSession,
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const portal = useMutation({
    mutationFn: createBillingCustomerPortal,
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const params = new URLSearchParams(window.location.search);
  const checkoutState = params.get("checkout");

  const statusLabelMap: Record<string, string> = {
    active: t.active,
    trialing: t.trialing,
    past_due: t.pastDue,
    canceled: t.canceled,
    unpaid: t.unpaid,
    incomplete: t.incomplete,
  };
  const rejectedPayment = payments.find((payment) => payment.status === "rejected");
  const trialEndingSoon = data?.trialEndsAt
    ? Math.ceil((new Date(data.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) <= 7
    : false;
  const remainingUsers = data?.limits.users == null ? null : Math.max(data.limits.users - data.usage.users, 0);
  const remainingWarehouses = data?.limits.warehouses == null ? null : Math.max(data.limits.warehouses - data.usage.warehouses, 0);
  const latestPayment = payments[0] ?? null;
  const manualPaymentDisplay = data ? getPrimaryAndSecondaryPrice({
    amount: data.manualPayment.amount,
    baseCurrency: data.manualPayment.baseCurrency,
    amountUsd: data.manualPayment.amountUsd,
    amountEgp: data.manualPayment.localAmountEgp,
  }) : null;

  return (
    <Layout>
      <PageHeader
        title={t.billing}
        subtitle={t.billingPortalHint}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/billing/pay"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {t.manualPayment}
            </Link>
            <button
              onClick={() => {
                void qc.invalidateQueries({ queryKey: ["billing-subscription"] });
                void qc.invalidateQueries({ queryKey: ["billing-payments"] });
                void qc.invalidateQueries({ queryKey: ["billing-invoices"] });
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {t.refresh}
            </button>
          </div>
        }
      />

      {checkoutState === "success" && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {t.checkoutSuccess}
        </div>
      )}
      {checkoutState === "canceled" && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t.checkoutCanceled}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr,1.4fr]">
          <div className="h-72 animate-pulse rounded-3xl bg-slate-200" />
          <div className="h-72 animate-pulse rounded-3xl bg-slate-200" />
        </div>
      ) : error || !data ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {(error as Error | undefined)?.message || t.serverError}
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-6 lg:grid-cols-[1.1fr,1.4fr]">
            <section className="rounded-3xl bg-[linear-gradient(135deg,#0f172a,#1e293b_55%,#0f766e)] p-6 text-white shadow-xl">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                    <Sparkles size={14} />
                    {t.currentPlan}
                  </div>
                  <h2 className="text-3xl font-bold">{planLabel(data.currentPlan, lang)}</h2>
                  <p className="mt-2 text-sm text-slate-200">{t.subscriptionStatus}: {statusLabelMap[data.billingStatus] || data.billingStatus}</p>
                </div>
                <CreditCard className="opacity-80" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs text-slate-200">{t.currentAppliedPrice}</div>
                  <div className="mt-1 text-sm font-semibold">
                    {manualPaymentDisplay ? formatCurrency(manualPaymentDisplay.primaryAmount, manualPaymentDisplay.primaryCurrency, lang) : "-"}
                  </div>
                  <div className="mt-1 text-xs text-slate-200/90">
                    {manualPaymentDisplay ? formatCurrency(manualPaymentDisplay.secondaryAmount, manualPaymentDisplay.secondaryCurrency, lang) : "-"}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs text-slate-200">{t.trialEndsAt}</div>
                  <div className="mt-1 text-sm font-semibold">{formatDate(data.trialEndsAt, locale)}</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs text-slate-200">{t.renewsAt}</div>
                  <div className="mt-1 text-sm font-semibold">{formatDate(data.subscriptionEndsAt, locale)}</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs text-slate-200">{t.usersLimit}</div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatNumber(data.usage.users, lang)} / {data.limits.users == null ? t.unlimited : formatNumber(data.limits.users, lang)}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs text-slate-200">{t.warehousesLimit}</div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatNumber(data.usage.warehouses, lang)} / {data.limits.warehouses == null ? t.unlimited : formatNumber(data.limits.warehouses, lang)}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => portal.mutate()}
                  disabled={portal.isPending}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {portal.isPending ? t.portalRedirecting : t.manageSubscription}
                </button>
                {!data.isActive && (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm">
                    <AlertCircle size={16} />
                    {t.noActiveSubscription}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{t.usage}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t.premiumFeatureNotice}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                  {t.chooseCycle}: {cycle === "monthly" ? t.monthly : t.yearly}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-700">
                    <Users size={18} />
                    <span className="font-medium">{t.usersLimit}</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">{formatNumber(data.usage.users, lang)}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {data.limits.users == null ? t.unlimited : `${formatNumber(data.limits.users, lang)} · ${t.remainingUsers}: ${formatNumber(remainingUsers ?? 0, lang)}`}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-700">
                    <Building2 size={18} />
                    <span className="font-medium">{t.warehousesLimit}</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">{formatNumber(data.usage.warehouses, lang)}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {data.limits.warehouses == null ? t.unlimited : `${formatNumber(data.limits.warehouses, lang)} · ${t.remainingWarehouses}: ${formatNumber(remainingWarehouses ?? 0, lang)}`}
                  </div>
                </div>
              </div>

              {(!data.isActive || data.billingStatus === "past_due" || data.billingStatus === "unpaid" || data.billingStatus === "incomplete") && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {t.subscriptionInactiveAlert}
                </div>
              )}
              {rejectedPayment && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {t.rejectedPaymentAlert}
                </div>
              )}
              {trialEndingSoon && data.billingStatus === "trialing" && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {t.trialEndingSoonAlert}
                </div>
              )}
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 text-sm font-medium text-slate-900">{t.availablePaymentMethods}</div>
                {data.manualPayment.methods.length === 0 ? (
                  <div className="text-sm text-slate-500">{t.noActivePaymentMethods}</div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {data.manualPayment.methods.map((method) => (
                      <div key={method.method} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <div className="font-medium text-slate-900">{paymentMethodLabel(method.method, t)}</div>
                        <div className="mt-2 text-xs text-slate-500">{t.accountName}</div>
                        <div className="text-sm text-slate-900">{method.accountName}</div>
                        <div className="mt-2 text-xs text-slate-500">{t.accountNumber}</div>
                        <div className="text-sm text-slate-900">{method.accountNumber}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-start">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{t.billing}</h3>
                <p className="mt-1 text-sm text-slate-500">{t.chooseCycle}</p>
              </div>
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {(["monthly", "yearly"] as const).map((value) => (
                  <a
                    key={value}
                    href={`?interval=${value}`}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                      cycle === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {value === "monthly" ? t.monthly : t.yearly}
                  </a>
                ))}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {data.plans.map((plan) => {
                const isCurrent = plan.key === data.currentPlan;
                const availablePrice = cycle === "monthly" ? plan.monthlyPriceId : plan.yearlyPriceId;

                return (
                  <article
                    key={plan.key}
                    className={`rounded-3xl border p-5 transition ${
                      isCurrent
                        ? "border-teal-500 bg-teal-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h4 className="text-xl font-bold text-slate-900">{planLabel(plan.key, lang)}</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          {cycle === "monthly" ? t.monthly : t.yearly}
                        </p>
                      </div>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-3 py-1 text-xs font-medium text-white">
                          <BadgeCheck size={14} />
                          {t.activeSubscription}
                        </span>
                      )}
                    </div>

                    <ul className="mb-6 space-y-3 text-sm text-slate-700">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <span className="mt-1 h-2 w-2 rounded-full bg-teal-500" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {plan.key === "enterprise" ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {t.openPlanHint}
                      </div>
                    ) : (
                      <button
                        onClick={() => checkout.mutate({ plan: plan.key, interval: cycle })}
                        disabled={checkout.isPending || (isCurrent && data.subscriptionInterval === cycle) || !availablePrice}
                        className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {checkout.isPending
                          ? t.checkoutRedirecting
                          : isCurrent
                            ? data.subscriptionInterval === cycle
                              ? t.manageSubscription
                              : planRank(plan.key) > planRank(data.currentPlan)
                                ? t.upgrade
                                : t.downgrade
                            : planRank(plan.key) > planRank(data.currentPlan)
                              ? t.upgrade
                              : planRank(plan.key) < planRank(data.currentPlan)
                                ? t.downgrade
                                : t.startSubscription}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr,1fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{t.manualPaymentHistory}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t.paymentStatusSummary}</p>
                </div>
                <Link href="/billing/pay" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                  {t.manualPayment}
                </Link>
              </div>

              {latestPayment && (
                <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs text-slate-500">{t.latestPaymentRequest}</div>
                      <div className="mt-1 font-medium text-slate-900">{formatCurrency(latestPayment.amount, data.manualPayment.localCurrency, lang)}</div>
                    </div>
                    <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${paymentStatusTone(latestPayment.status)}`}>
                          {paymentStatusLabel(latestPayment.status, t)}
                        </div>
                  </div>
                </div>
              )}

              {payments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  {t.noPaymentsYet}
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.slice(0, 5).map((payment) => (
                    <div key={payment.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-900">{paymentMethodLabel(payment.method, t)}</div>
                          <div className="mt-1 text-xs text-slate-500">{payment.referenceNumber}</div>
                        </div>
                        <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${paymentStatusTone(payment.status)}`}>
                          {paymentStatusLabel(payment.status, t)}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                        <span>{formatCurrency(payment.amount, data.manualPayment.localCurrency, lang)}</span>
                        <span>{formatDate(payment.createdAt, locale)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{t.invoiceHistory}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t.invoiceHistorySubtitle}</p>
                </div>
                <Receipt className="text-slate-400" size={18} />
              </div>

              {invoices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  {t.noInvoicesYet}
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-900">{invoice.invoiceNumber}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatDate(invoice.issuedAt, locale)}</div>
                        </div>
                        <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${invoiceStatusTone(invoice.status)}`}>
                          {invoice.status}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                        <span>{formatCurrency(invoice.amount, invoice.currency, lang)}</span>
                        <button
                          type="button"
                          onClick={() => printInvoice(invoice, t.companyBillingDocument, locale, t.invoiceHistory)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          <Download size={14} />
                          {t.downloadPdf}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </Layout>
  );
}
