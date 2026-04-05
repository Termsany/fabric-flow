import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CreditCard, RefreshCw, Settings2, Tags } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminSectionCard } from "@/components/admin/AdminSectionCard";
import { ConfirmDialog } from "@/components/payment-methods/ConfirmDialog";
import { PlanFormModal } from "@/components/plans/PlanFormModal";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPlans, useApplyAdminPlanPriceAll, useApplyAdminPlanPriceSelected, useUpdateAdminPlan } from "@/hooks/use-plans";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import {
  extendAdminTenantTrial,
  getAdminPaymentMethodDefinitions,
  getAdminBillingOverview,
  syncAdminTenantBilling,
  updateAdminPaymentMethodDefinition,
  updateAdminTenantBillingStatus,
  updateAdminTenantPlan,
  type AdminBillingResponse,
  type AdminPaymentMethodDefinition,
} from "@/lib/admin-tenants";
import type { PlanRecord } from "@/lib/plans";

function formatPlanLabel(plan: string, lang: string, planNames?: Map<string, { ar: string; en: string }>) {
  const configured = planNames?.get(plan);
  if (configured) {
    return lang === "ar" ? configured.ar : configured.en;
  }
  if (lang === "ar") {
    if (plan === "pro") return "برو";
    if (plan === "enterprise") return "الخطة المفتوحة";
    return "أساسية";
  }
  if (plan === "pro") return "Pro";
  if (plan === "enterprise") return "Open Plan";
  return "Basic";
}

type PriceApplyDraft = {
  plan: PlanRecord;
  interval: "monthly" | "yearly";
  mode: "all" | "selected";
  tenantIds: number[];
  applyOnNextBilling: boolean;
};

export function AdminBillingPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { data: plans = [] } = useAdminPlans();
  const updatePlanMutation = useUpdateAdminPlan();
  const applyPriceAllMutation = useApplyAdminPlanPriceAll();
  const applyPriceSelectedMutation = useApplyAdminPlanPriceSelected();
  const [data, setData] = useState<AdminBillingResponse | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<AdminPaymentMethodDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyMethod, setBusyMethod] = useState<string | null>(null);
  const [editingMethod, setEditingMethod] = useState<AdminPaymentMethodDefinition | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);
  const [priceApplyDraft, setPriceApplyDraft] = useState<PriceApplyDraft | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [intervalFilter, setIntervalFilter] = useState("all");

  const load = async () => {
    setError("");
    setIsLoading(true);
    try {
      const [overview, methods] = await Promise.all([
        getAdminBillingOverview(),
        getAdminPaymentMethodDefinitions(),
      ]);
      setData(overview);
      setPaymentMethods(methods);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const runAction = async (tenantId: number, action: () => Promise<unknown>) => {
    setBusyId(tenantId);
    setError("");
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    } finally {
      setBusyId(null);
    }
  };

  const runMethodAction = async (method: string, action: () => Promise<AdminPaymentMethodDefinition>) => {
    setBusyMethod(method);
    setError("");
    try {
      const updated = await action();
      setPaymentMethods((current) => current.map((item) => (item.method === updated.method ? updated : item)));
      setEditingMethod(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    } finally {
      setBusyMethod(null);
    }
  };
  const canManageBilling = user?.role === "super_admin";
  const planNames = useMemo(
    () => new Map(plans.map((plan) => [plan.code, { ar: plan.nameAr, en: plan.nameEn }])),
    [plans],
  );
  const alertTypeLabels = {
    past_due: t.pastDue,
    payment_failed: t.payment_failed,
    ending_soon: t.ending_soon,
  } as const;

  const getPlanTenants = (planCode: string, interval: "monthly" | "yearly") =>
    (data?.subscriptions ?? []).filter((subscription) =>
      subscription.currentPlan === planCode && (subscription.subscriptionInterval ?? "monthly") === interval,
    );

  const filteredSubscriptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (data?.subscriptions ?? []).filter((subscription) => {
      const matchesSearch = !normalizedSearch || subscription.name.toLowerCase().includes(normalizedSearch);
      const matchesPlan = planFilter === "all" || subscription.currentPlan === planFilter;
      const matchesStatus = statusFilter === "all" || subscription.billingStatus === statusFilter;
      const effectiveInterval = subscription.subscriptionInterval ?? "monthly";
      const matchesInterval = intervalFilter === "all" || effectiveInterval === intervalFilter;
      return matchesSearch && matchesPlan && matchesStatus && matchesInterval;
    });
  }, [data?.subscriptions, search, planFilter, statusFilter, intervalFilter]);

  const handleApplyPrice = async () => {
    if (!priceApplyDraft) return;

    try {
      const payload = {
        interval: priceApplyDraft.interval,
        applyOnNextBilling: priceApplyDraft.applyOnNextBilling,
      };

      const result = priceApplyDraft.mode === "all"
        ? await applyPriceAllMutation.mutateAsync({
            id: priceApplyDraft.plan.id,
            payload,
          })
        : await applyPriceSelectedMutation.mutateAsync({
            id: priceApplyDraft.plan.id,
            payload: { ...payload, tenantIds: priceApplyDraft.tenantIds },
          });

      await load();
      toast({
        title: t.saveChanges,
        description: lang === "ar"
          ? `تم تحديث ${formatNumber(result.updatedCount, lang)} اشتراك بالسعر الجديد.`
          : `Updated ${formatNumber(result.updatedCount, lang)} subscriptions with the new price.`,
      });
      setPriceApplyDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    }
  };

  const isApplyingPrice = applyPriceAllMutation.isPending || applyPriceSelectedMutation.isPending;

  return (
    <Layout>
      <PageHeader
        title={t.adminBilling}
        subtitle={t.adminBillingSubtitle}
        action={(
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/payments"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <CreditCard size={16} />
              {t.openManualPayments}
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              {t.refreshData}
            </button>
          </div>
        )}
      />

      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : !data ? (
        <AdminEmptyState title={t.failedToLoadData} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-5">
            <AdminMetricCard label={t.tenants} value={formatNumber(data.summary.totalSubscriptions, lang)} />
            <AdminMetricCard label={t.active} value={formatNumber(data.summary.activeSubscriptions, lang)} tone="success" />
            <AdminMetricCard label={t.trialing} value={formatNumber(data.summary.trialingSubscriptions, lang)} tone="warning" />
            <AdminMetricCard label={t.pastDue} value={formatNumber(data.summary.pastDueSubscriptions, lang)} tone="danger" />
            <AdminMetricCard label="MRR" value={`${formatNumber(data.summary.mrrEstimate, lang)} EGP`} tone="primary" />
          </div>

          <AdminSectionCard title={t.billingAlerts} subtitle={t.billingAlertsSubtitle} action={<AlertTriangle size={18} className="text-amber-500" />}>
            {data.alerts.length === 0 ? (
              <AdminEmptyState title={t.noBillingAlerts} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.alerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href={`/admin/tenants/${alert.tenantId}?tab=billing`}
                    className={`rounded-2xl border px-4 py-4 transition hover:shadow-sm ${
                      alert.severity === "high"
                        ? "border-rose-200 bg-rose-50"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{alert.tenantName}</div>
                        <div className="mt-1 text-xs text-slate-500">{alertTypeLabels[alert.type]}</div>
                        </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        alert.severity === "high" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {alert.severity === "high" ? t.highPriority : t.mediumPriority}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-slate-700">{alert.message}</div>
                  </Link>
                ))}
              </div>
            )}
          </AdminSectionCard>

          <AdminSectionCard title={t.pricingSettings} subtitle={t.pricingSectionHint}>
            <div className="mb-4 flex flex-wrap gap-2">
              <Link
                href="/admin/plans"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Tags size={16} />
                {t.plansManagement}
              </Link>
              <Link
                href="/admin/payment-methods"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Settings2 size={16} />
                {t.paymentMethodsAdmin}
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {plans
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((plan) => {
                  const monthly = plan.prices.find((price) => price.interval === "monthly");
                  const yearly = plan.prices.find((price) => price.interval === "yearly");
                  const monthlyTenants = getPlanTenants(plan.code, "monthly");
                  const yearlyTenants = getPlanTenants(plan.code, "yearly");

                  return (
                <div key={plan.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-base font-semibold text-slate-900">{lang === "ar" ? plan.nameAr : plan.nameEn}</div>
                    {canManageBilling ? (
                      <button
                        type="button"
                        onClick={() => setEditingPlan(plan)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                      >
                        {t.edit}
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{lang === "ar" ? plan.descriptionAr : plan.descriptionEn}</div>
                  <div className="mt-3 text-xs text-slate-500">
                    {lang === "ar"
                      ? `${formatNumber(plan.subscribersCount, lang)} شركة على الخطة`
                      : `${formatNumber(plan.subscribersCount, lang)} tenants on this plan`}
                  </div>
                  <div className="mt-3 text-sm text-slate-500">{t.monthly}</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {monthly ? formatCurrency(monthly.amount, monthly.baseCurrency, lang) : "-"}
                  </div>
                  {monthly ? <div className="mt-1 text-xs text-slate-500">{formatCurrency(monthly.baseCurrency === "USD" ? monthly.egpAmount : monthly.usdAmount, monthly.baseCurrency === "USD" ? monthly.egpCurrency : monthly.usdCurrency, lang)}</div> : null}
                  <div className="mt-1 text-xs text-slate-500">
                    {lang === "ar"
                      ? `${formatNumber(monthlyTenants.length, lang)} شركة على الشهري`
                      : `${formatNumber(monthlyTenants.length, lang)} monthly tenants`}
                  </div>
                  {canManageBilling && monthly ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPriceApplyDraft({
                          plan,
                          interval: "monthly",
                          mode: "all",
                          tenantIds: [],
                          applyOnNextBilling: true,
                        })}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                      >
                        {t.applyPriceToAll}
                      </button>
                      <button
                        type="button"
                        disabled={monthlyTenants.length === 0}
                        onClick={() => setPriceApplyDraft({
                          plan,
                          interval: "monthly",
                          mode: "selected",
                          tenantIds: monthlyTenants.map((item) => item.id),
                          applyOnNextBilling: true,
                        })}
                        className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 disabled:opacity-60"
                      >
                        {t.applyPriceToSelected}
                      </button>
                    </div>
                  ) : null}
                  <div className="mt-3 text-sm text-slate-500">{t.yearly}</div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {yearly ? formatCurrency(yearly.amount, yearly.baseCurrency, lang) : "-"}
                  </div>
                  {yearly ? <div className="mt-1 text-xs text-slate-500">{formatCurrency(yearly.baseCurrency === "USD" ? yearly.egpAmount : yearly.usdAmount, yearly.baseCurrency === "USD" ? yearly.egpCurrency : yearly.usdCurrency, lang)}</div> : null}
                  <div className="mt-1 text-xs text-slate-500">
                    {lang === "ar"
                      ? `${formatNumber(yearlyTenants.length, lang)} شركة على السنوي`
                      : `${formatNumber(yearlyTenants.length, lang)} yearly tenants`}
                  </div>
                  {canManageBilling && yearly ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPriceApplyDraft({
                          plan,
                          interval: "yearly",
                          mode: "all",
                          tenantIds: [],
                          applyOnNextBilling: true,
                        })}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                      >
                        {t.applyPriceToAll}
                      </button>
                      <button
                        type="button"
                        disabled={yearlyTenants.length === 0}
                        onClick={() => setPriceApplyDraft({
                          plan,
                          interval: "yearly",
                          mode: "selected",
                          tenantIds: yearlyTenants.map((item) => item.id),
                          applyOnNextBilling: true,
                        })}
                        className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 disabled:opacity-60"
                      >
                        {t.applyPriceToSelected}
                      </button>
                    </div>
                  ) : null}
                </div>
              )})}
            </div>
          </AdminSectionCard>

          <AdminSectionCard title={t.globalPaymentMethods} subtitle={t.globalPaymentMethodsSubtitle}>
            <div className="grid gap-4 lg:grid-cols-2">
              {paymentMethods.map((method) => (
                <div key={method.method} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{t[method.method]}</div>
                      <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${method.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {method.isActive ? t.globallyEnabled : t.globallyDisabled}
                      </div>
                    </div>
                    <CreditCard size={18} className="text-slate-400" />
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">{t.accountNumber}</div>
                      <div className="mt-1 text-slate-900">{method.accountNumber || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">{t.accountName}</div>
                      <div className="mt-1 text-slate-900">{method.accountName || "-"}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyMethod === method.method || !canManageBilling}
                      onClick={() => void runMethodAction(method.method, () => updateAdminPaymentMethodDefinition(method.method, {
                        is_active: !method.isActive,
                        account_number: method.accountNumber,
                        account_name: method.accountName,
                        instructions: method.instructionsAr,
                      }))}
                      className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${method.isActive ? "bg-rose-600" : "bg-emerald-600"}`}
                    >
                      {method.isActive ? t.disableGlobally : t.enableGlobally}
                    </button>
                    <button
                      type="button"
                      disabled={!canManageBilling}
                      onClick={() => setEditingMethod({ ...method })}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                    >
                      {t.edit}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </AdminSectionCard>

          <AdminSectionCard title={t.billing} subtitle={t.billingActions} action={<CreditCard size={18} className="text-slate-400" />}>
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t.searchTenantPlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
              <select
                value={planFilter}
                onChange={(event) => setPlanFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
              >
                <option value="all">{t.allPlans}</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.code}>{lang === "ar" ? plan.nameAr : plan.nameEn}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
              >
                <option value="all">{t.allStatuses}</option>
                <option value="active">{t.active}</option>
                <option value="trialing">{t.trialing}</option>
                <option value="past_due">{t.pastDue}</option>
                <option value="canceled">{t.canceled}</option>
                <option value="unpaid">{t.unpaid}</option>
                <option value="incomplete">{t.incomplete}</option>
              </select>
              <select
                value={intervalFilter}
                onChange={(event) => setIntervalFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
              >
                <option value="all">{t.allBillingCycles}</option>
                <option value="monthly">{t.monthly}</option>
                <option value="yearly">{t.yearly}</option>
              </select>
            </div>

            {filteredSubscriptions.length === 0 ? (
              <AdminEmptyState title={t.noData} description={t.noInvoicesYet} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-start font-medium">{t.companyName}</th>
                      <th className="px-4 py-3 text-start font-medium">{t.plan}</th>
                      <th className="px-4 py-3 text-start font-medium">{t.billingCycle}</th>
                      <th className="px-4 py-3 text-start font-medium">{t.subscriptionStatus}</th>
                      <th className="px-4 py-3 text-start font-medium">{t.lastInvoice}</th>
                      <th className="px-4 py-3 text-start font-medium">{t.renewalDate}</th>
                      <th className="px-4 py-3 text-start font-medium">{t.users}</th>
                      <th className="px-4 py-3 text-start font-medium">{t.manualActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubscriptions.map((subscription) => (
                      <tr key={subscription.id}>
                        <td className="px-4 py-4 align-top">
                          <Link href={`/admin/tenants/${subscription.id}?tab=billing`} className="font-semibold text-slate-900 hover:text-indigo-700">
                            {subscription.name}
                          </Link>
                        </td>
                        <td className="px-4 py-4 align-top">{formatPlanLabel(subscription.currentPlan, lang, planNames)}</td>
                        <td className="px-4 py-4 align-top text-slate-500">
                          {subscription.subscriptionInterval === "yearly" ? t.yearly : t.monthly}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <StatusBadge status={subscription.billingStatus === "canceled" ? "CANCELLED" : subscription.billingStatus} />
                        </td>
                        <td className="px-4 py-4 align-top text-slate-500">{subscription.lastInvoiceStatus || "-"}</td>
                        <td className="px-4 py-4 align-top text-slate-500">
                          {subscription.subscriptionEndsAt ? formatDate(subscription.subscriptionEndsAt, lang) : subscription.trialEndsAt ? formatDate(subscription.trialEndsAt, lang) : "-"}
                        </td>
                        <td className="px-4 py-4 align-top text-slate-500">{formatNumber(subscription.usersCount, lang)}</td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busyId === subscription.id || !canManageBilling}
                              onClick={() => void runAction(subscription.id, () => updateAdminTenantPlan(subscription.id, subscription.currentPlan === "basic" ? "pro" : "basic"))}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {t.changePlanShort}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === subscription.id || !canManageBilling}
                              onClick={() => void runAction(subscription.id, () => extendAdminTenantTrial(subscription.id, 14))}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {t.extendTrial}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === subscription.id || !canManageBilling}
                              onClick={() => void runAction(subscription.id, () => updateAdminTenantBillingStatus(subscription.id, subscription.isActive ? "canceled" : "active", !subscription.isActive, "end_of_period"))}
                              className={`rounded-xl px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${subscription.isActive ? "bg-rose-600" : "bg-emerald-600"}`}
                            >
                              {subscription.isActive ? t.suspendTenant : t.reactivateTenant}
                            </button>
                            {subscription.isActive ? (
                              <button
                                type="button"
                                disabled={busyId === subscription.id || !canManageBilling}
                                onClick={() => void runAction(subscription.id, () => updateAdminTenantBillingStatus(subscription.id, "canceled", false, "immediate"))}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {t.cancelImmediately}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={busyId === subscription.id}
                              onClick={() => void runAction(subscription.id, () => syncAdminTenantBilling(subscription.id))}
                              className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 disabled:opacity-60"
                            >
                              {t.syncStripeMetadata}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminSectionCard>

          <AdminSectionCard title={t.financialAuditLog} subtitle={t.financialAuditLogSubtitle}>
            {data.auditLogs.length === 0 ? (
              <AdminEmptyState title={t.noFinancialAuditLogs} />
            ) : (
              <div className="space-y-3">
                {data.auditLogs.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-slate-900">{entry.action}</div>
                      <div className="text-xs text-slate-500">{formatDate(entry.createdAt, lang)}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{entry.adminEmail}</span>
                      <span>•</span>
                      <span>{entry.adminRole}</span>
                      {entry.targetTenantId ? (
                        <>
                          <span>•</span>
                          <Link href={`/admin/tenants/${entry.targetTenantId}?tab=billing`} className="text-indigo-700 hover:text-indigo-900">
                            {t.openTenantDetails}
                          </Link>
                        </>
                      ) : null}
                    </div>
                    {entry.metadata ? (
                      <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-3 text-xs text-slate-600">{entry.metadata}</pre>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </AdminSectionCard>
        </div>
      )}

      {editingMethod ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">{t.editGlobalPaymentMethod}</h2>
            <div className="mt-5 space-y-4">
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span>{t.globallyEnabled}</span>
                <input
                  type="checkbox"
                  checked={editingMethod.isActive}
                  onChange={(event) => setEditingMethod({ ...editingMethod, isActive: event.target.checked })}
                />
              </label>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{t.accountNumber}</label>
                <input
                  value={editingMethod.accountNumber}
                  onChange={(event) => setEditingMethod({ ...editingMethod, accountNumber: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{t.accountName}</label>
                <input
                  value={editingMethod.accountName}
                  onChange={(event) => setEditingMethod({ ...editingMethod, accountName: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{t.paymentInstructions}</label>
                <textarea
                  value={editingMethod.instructionsAr}
                  onChange={(event) => setEditingMethod({ ...editingMethod, instructionsAr: event.target.value })}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingMethod(null)} className="rounded-xl px-4 py-2 text-sm text-slate-600">
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={busyMethod === editingMethod.method}
                onClick={() => void runMethodAction(editingMethod.method, () => updateAdminPaymentMethodDefinition(editingMethod.method, {
                  is_active: editingMethod.isActive,
                  account_number: editingMethod.accountNumber,
                  account_name: editingMethod.accountName,
                  instructions: editingMethod.instructionsAr,
                }))}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {t.saveChanges}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PlanFormModal
        open={Boolean(editingPlan)}
        plan={editingPlan}
        title={t.edit}
        description={t.pricingSettings}
        saveLabel={t.saveChanges}
        cancelLabel={t.cancel}
        loading={updatePlanMutation.isPending}
        onClose={() => setEditingPlan(null)}
        onSave={(payload) => {
          if (!editingPlan) return;
          void updatePlanMutation.mutateAsync({ id: editingPlan.id, payload }).then(() => {
            toast({ title: t.saveChanges, description: t.planUpdated });
            setEditingPlan(null);
          }).catch((err) => {
            setError(err instanceof Error ? err.message : t.failedToLoadData);
          });
        }}
      />

      {priceApplyDraft?.mode === "all" ? (
        <ConfirmDialog
          open
          title={t.applyPriceToAll}
          description={
            lang === "ar"
              ? `سيتم تطبيق سعر ${priceApplyDraft.interval === "monthly" ? t.monthly : t.yearly} لخطة ${formatPlanLabel(priceApplyDraft.plan.code, lang, planNames)} على كل الشركات المشتركة بهذه الدورة.`
              : `This will apply the ${priceApplyDraft.interval} price for ${formatPlanLabel(priceApplyDraft.plan.code, lang, planNames)} to all tenants on this billing cycle.`
          }
          confirmLabel={t.confirm}
          cancelLabel={t.cancel}
          loading={isApplyingPrice}
          onClose={() => setPriceApplyDraft(null)}
          onConfirm={() => void handleApplyPrice()}
        />
      ) : null}

      {priceApplyDraft?.mode === "selected" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">{t.applyPriceToSelected}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {lang === "ar"
                ? `اختر الشركات التي تريد تحديث سعر ${priceApplyDraft.interval === "monthly" ? t.monthly : t.yearly} لها.`
                : `Select the tenants you want to update for the ${priceApplyDraft.interval} billing cycle.`}
            </p>

            <div className="mt-5 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
              {getPlanTenants(priceApplyDraft.plan.code, priceApplyDraft.interval).length === 0 ? (
                <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-slate-500">{t.noEligibleTenants}</div>
              ) : (
                getPlanTenants(priceApplyDraft.plan.code, priceApplyDraft.interval).map((subscription) => (
                  <label key={subscription.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                    <div>
                      <div className="font-medium text-slate-900">{subscription.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatPlanLabel(subscription.currentPlan, lang, planNames)} · {subscription.subscriptionInterval === "yearly" ? t.yearly : t.monthly}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={priceApplyDraft.tenantIds.includes(subscription.id)}
                      onChange={(event) => {
                        setPriceApplyDraft((current) => {
                          if (!current) return current;
                          return {
                            ...current,
                            tenantIds: event.target.checked
                              ? [...current.tenantIds, subscription.id]
                              : current.tenantIds.filter((tenantId) => tenantId !== subscription.id),
                          };
                        });
                      }}
                    />
                  </label>
                ))
              )}
            </div>

            <label className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>{t.applyOnNextBilling}</span>
              <input
                type="checkbox"
                checked={priceApplyDraft.applyOnNextBilling}
                onChange={(event) => setPriceApplyDraft((current) => current ? { ...current, applyOnNextBilling: event.target.checked } : current)}
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPriceApplyDraft(null)} className="rounded-xl px-4 py-2 text-sm text-slate-600">
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={isApplyingPrice || priceApplyDraft.tenantIds.length === 0}
                onClick={() => void handleApplyPrice()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {t.saveChanges}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
