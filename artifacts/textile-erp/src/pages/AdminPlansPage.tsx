import { useMemo, useState } from "react";
import { PlusCircle, RefreshCw } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { PlanFormModal } from "@/components/plans/PlanFormModal";
import { useLang } from "@/contexts/LangContext";
import { useCreateAdminPlan, useAdminPlans, useUpdateAdminPlan } from "@/hooks/use-plans";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { PlanRecord, PlanUpsertPayload } from "@/lib/plans";

function toPlanPayload(plan: PlanRecord): PlanUpsertPayload {
  return {
    code: plan.code,
    nameAr: plan.nameAr,
    nameEn: plan.nameEn,
    descriptionAr: plan.descriptionAr,
    descriptionEn: plan.descriptionEn,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
    prices: plan.prices.map((price) => ({
      interval: price.interval,
      currency: price.currency,
      amount: price.amount,
      trialDays: price.trialDays,
      stripePriceId: price.stripePriceId ?? null,
      localPaymentEnabled: price.localPaymentEnabled,
      isActive: price.isActive,
    })),
    features: plan.features.map((feature) => ({
      featureKey: feature.featureKey,
      labelAr: feature.labelAr,
      labelEn: feature.labelEn,
      included: feature.included,
      sortOrder: feature.sortOrder,
    })),
  };
}

export function AdminPlansPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { data: plans = [], isLoading, error, refetch } = useAdminPlans();
  const createMutation = useCreateAdminPlan();
  const updateMutation = useUpdateAdminPlan();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PlanRecord | null>(null);
  const [creating, setCreating] = useState(false);

  const filteredPlans = useMemo(
    () => plans.filter((plan) => !search.trim() || plan.nameAr.includes(search.trim()) || plan.nameEn.toLowerCase().includes(search.trim().toLowerCase()) || plan.code.includes(search.trim().toLowerCase())),
    [plans, search],
  );

  const stats = useMemo(() => ({
    total: plans.length,
    active: plans.filter((plan) => plan.isActive).length,
    subscriptions: plans.reduce((sum, plan) => sum + plan.subscribersCount, 0),
  }), [plans]);

  const canManage = user?.role === "super_admin";

  const handleTogglePlan = (plan: PlanRecord) => {
    void updateMutation.mutateAsync({
      id: plan.id,
      payload: {
        ...toPlanPayload(plan),
        isActive: !plan.isActive,
      },
    }).then(() => {
      toast({
        title: t.saveChanges,
        description: !plan.isActive ? t.enable : t.disable,
      });
    });
  };

  return (
    <Layout>
      <PageHeader
        title={t.plansManagement}
        subtitle={t.adminBillingSubtitle}
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void refetch()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
              <RefreshCw size={16} />
              {t.refreshData}
            </button>
            {canManage ? (
              <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
                <PlusCircle size={16} />
                {t.create}
              </button>
            ) : null}
          </div>
        )}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{t.totalPlans}</div><div className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(stats.total, lang)}</div></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{t.activePlans}</div><div className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(stats.active, lang)}</div></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{t.payments}</div><div className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(stats.subscriptions, lang)}</div></div>
      </div>

      <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error instanceof Error ? error.message : t.failedToLoadData}</div> : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="grid gap-4 p-5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div>
        ) : filteredPlans.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">{t.noData}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-start">{t.plan}</th>
                  <th className="px-4 py-3 text-start">{t.code}</th>
                  <th className="px-4 py-3 text-start">{t.status}</th>
                  <th className="px-4 py-3 text-start">{t.monthly}</th>
                  <th className="px-4 py-3 text-start">{t.yearly}</th>
                  <th className="px-4 py-3 text-start">{t.users}</th>
                  <th className="px-4 py-3 text-start">{t.lastUpdated}</th>
                  <th className="px-4 py-3 text-start">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPlans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-4 py-4 font-medium text-slate-900">{lang === "ar" ? plan.nameAr : plan.nameEn}</td>
                    <td className="px-4 py-4 text-slate-500">{plan.code}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${plan.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{plan.isActive ? t.active : t.inactive}</span></td>
                    <td className="px-4 py-4 text-slate-500">
                      {(() => {
                        const price = plan.prices.find((item) => item.interval === "monthly");
                        return price ? (
                          <div>
                            <div>{formatCurrency(price.amount, price.baseCurrency, lang)}</div>
                            <div className="text-xs text-slate-400">{formatCurrency(price.baseCurrency === "USD" ? price.egpAmount : price.usdAmount, price.baseCurrency === "USD" ? price.egpCurrency : price.usdCurrency, lang)}</div>
                          </div>
                        ) : "-";
                      })()}
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {(() => {
                        const price = plan.prices.find((item) => item.interval === "yearly");
                        return price ? (
                          <div>
                            <div>{formatCurrency(price.amount, price.baseCurrency, lang)}</div>
                            <div className="text-xs text-slate-400">{formatCurrency(price.baseCurrency === "USD" ? price.egpAmount : price.usdAmount, price.baseCurrency === "USD" ? price.egpCurrency : price.usdCurrency, lang)}</div>
                          </div>
                        ) : "-";
                      })()}
                    </td>
                    <td className="px-4 py-4 text-slate-500">{formatNumber(plan.subscribersCount, lang)}</td>
                    <td className="px-4 py-4 text-slate-500">{formatDateTime(plan.updatedAt, lang)}</td>
                    <td className="px-4 py-4">
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setEditing(plan)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                            {t.edit}
                          </button>
                          <button
                            type="button"
                            disabled={updateMutation.isPending}
                            onClick={() => handleTogglePlan(plan)}
                            className={`rounded-xl px-3 py-2 text-xs font-medium text-white disabled:opacity-60 ${plan.isActive ? "bg-rose-600" : "bg-emerald-600"}`}
                          >
                            {plan.isActive ? t.disable : t.enable}
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PlanFormModal
        open={canManage && creating}
        plan={null}
        title={t.create}
        description={t.pricingSettings}
        saveLabel={t.saveChanges}
        cancelLabel={t.cancel}
        loading={createMutation.isPending}
        onClose={() => setCreating(false)}
        onSave={(payload) => {
          void createMutation.mutateAsync(payload).then(() => {
            toast({ title: t.saveChanges, description: t.planUpdated });
            setCreating(false);
          });
        }}
      />

      <PlanFormModal
        open={canManage && Boolean(editing)}
        plan={editing}
        title={t.edit}
        description={t.pricingSettings}
        saveLabel={t.saveChanges}
        cancelLabel={t.cancel}
        loading={updateMutation.isPending}
        onClose={() => setEditing(null)}
        onSave={(payload) => {
          if (!editing) return;
          void updateMutation.mutateAsync({ id: editing.id, payload }).then(() => {
            toast({ title: t.saveChanges, description: t.planUpdated });
            setEditing(null);
          });
        }}
      />
    </Layout>
  );
}
