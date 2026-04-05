import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CreditCard, Eye, Power, Search, Settings, ShieldCheck, UserCog } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatNumber } from "@/lib/format";
import {
  adminTenantQueryKeys,
  impersonateTenantAdmin,
  listAdminTenants,
  updateAdminTenantStatus,
  type AdminTenantListItem,
} from "@/lib/admin-tenants";

function formatPlanLabel(plan: string, t: Record<string, string>, lang: string) {
  if (lang === "ar") {
    if (plan === "pro") return "برو";
    if (plan === "enterprise") return "الخطة المفتوحة";
    return "أساسية";
  }

  return t[plan] || plan;
}

function PlanBadge({ plan, lang }: { plan: string; lang: string }) {
  const classes: Record<string, string> = {
    basic: "bg-slate-100 text-slate-700",
    pro: "bg-indigo-100 text-indigo-700",
    enterprise: "bg-amber-100 text-amber-800",
  };

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes[plan] || classes.basic}`}>{formatPlanLabel(plan, {}, lang)}</span>;
}

export function AdminTenantsPage() {
  const { t, lang } = useLang();
  const { login, user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [confirmTenant, setConfirmTenant] = useState<AdminTenantListItem | null>(null);
  const [busyTenantId, setBusyTenantId] = useState<number | null>(null);

  const filters = useMemo(() => ({ search: search.trim(), status, plan }), [plan, search, status]);
  const tenantsQuery = useQuery({
    queryKey: adminTenantQueryKeys.list(filters),
    queryFn: () => listAdminTenants(filters),
  });
  const tenants = tenantsQuery.data ?? [];
  const isLoading = tenantsQuery.isLoading;

  const summary = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter((tenant) => tenant.isActive).length,
    pastDue: tenants.filter((tenant) => tenant.billingStatus === "past_due").length,
    users: tenants.reduce((sum, tenant) => sum + tenant.usersCount, 0),
  }), [tenants]);
  const canManageTenant = user?.role === "super_admin" || user?.role === "support_admin";
  const canImpersonate = canManageTenant;
  const canManageBilling = user?.role === "super_admin" || user?.role === "billing_admin";

  useEffect(() => {
    if (tenantsQuery.error) {
      setError(tenantsQuery.error instanceof Error ? tenantsQuery.error.message : t.failedToLoadData);
      return;
    }
    setError("");
  }, [t, tenantsQuery.error]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ tenantId, isActive }: { tenantId: number; isActive: boolean }) =>
      updateAdminTenantStatus(tenantId, isActive),
    onSuccess: async (data, variables) => {
      queryClient.setQueriesData<AdminTenantListItem[]>(
        { queryKey: adminTenantQueryKeys.all },
        (current) =>
          current?.map((tenant) =>
            tenant.id === variables.tenantId
              ? {
                  ...tenant,
                  name: data.name,
                  isActive: data.isActive,
                  currentPlan: data.currentPlan,
                  billingStatus: data.billingStatus,
                }
              : tenant,
          ) ?? current,
      );

      queryClient.setQueryData(
        adminTenantQueryKeys.detail(variables.tenantId),
        (current: any) =>
          current
            ? {
                ...current,
                name: data.name,
                isActive: data.isActive,
                currentPlan: data.currentPlan,
                billingStatus: data.billingStatus,
                updatedAt: data.updatedAt,
              }
            : current,
      );

      await queryClient.invalidateQueries({ queryKey: adminTenantQueryKeys.all });
      await queryClient.refetchQueries({ queryKey: adminTenantQueryKeys.all, type: "active" });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    },
    onSettled: () => {
      setBusyTenantId(null);
      setConfirmTenant(null);
    },
  });

  const handleToggleStatus = async () => {
    if (!confirmTenant) return;
    setBusyTenantId(confirmTenant.id);
    await updateStatusMutation.mutateAsync({ tenantId: confirmTenant.id, isActive: !confirmTenant.isActive });
  };

  const handleImpersonate = async (tenantId: number) => {
    setBusyTenantId(tenantId);
    setError("");
    try {
      const data = await impersonateTenantAdmin(tenantId);
      login(data as any);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    } finally {
      setBusyTenantId(null);
    }
  };

  return (
    <Layout>
      <PageHeader
        title={t.tenants}
        subtitle={t.tenantManagement}
        action={(
          <button
            type="button"
            onClick={() => void tenantsQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ShieldCheck size={16} />
            {t.refreshData}
          </button>
        )}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <AdminMetricCard label={t.tenants} value={formatNumber(summary.total, lang)} />
        <AdminMetricCard label={t.active} value={formatNumber(summary.active, lang)} tone="success" />
        <AdminMetricCard label={t.pastDue} value={formatNumber(summary.pastDue, lang)} tone="warning" />
        <AdminMetricCard label={t.users} value={formatNumber(summary.users, lang)} tone="primary" />
      </div>

      <div className="mb-6 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.6fr_1fr_1fr]">
        <label className="relative block">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto text-slate-400" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.searchTenantsPlaceholder}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 ps-9 pe-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
          />
        </label>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
        >
          <option value="all">{t.allStatuses}</option>
          <option value="active">{t.active}</option>
          <option value="inactive">{t.inactive}</option>
        </select>

        <select
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
        >
          <option value="all">{t.allPlans}</option>
          <option value="enterprise">{formatPlanLabel("enterprise", {}, lang)}</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <div className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-6">
            <AdminEmptyState title={t.noTenantsYet} description={t.tenantManagement} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-start font-medium text-slate-600">{t.companyName}</th>
                  <th className="px-4 py-3 text-start font-medium text-slate-600">{t.status}</th>
                  <th className="px-4 py-3 text-start font-medium text-slate-600">{t.plan}</th>
                  <th className="px-4 py-3 text-start font-medium text-slate-600">{t.subscriptionStatus}</th>
                  <th className="px-4 py-3 text-start font-medium text-slate-600">{t.usersCount}</th>
                  <th className="px-4 py-3 text-start font-medium text-slate-600">{t.renewalDate}</th>
                  <th className="px-4 py-3 text-start font-medium text-slate-600">{t.createdAt}</th>
                  <th className="px-4 py-3 text-start font-medium text-slate-600">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-slate-900">{tenant.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{tenant.country}</div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tenant.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {tenant.isActive ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <PlanBadge plan={tenant.currentPlan} lang={lang} />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge status={tenant.billingStatus === "canceled" ? "CANCELLED" : tenant.billingStatus} />
                    </td>
                    <td className="px-4 py-4 align-top font-medium text-slate-700">{formatNumber(tenant.usersCount, lang)}</td>
                    <td className="px-4 py-4 align-top text-slate-500">
                      {tenant.subscriptionEndsAt ? formatDate(tenant.subscriptionEndsAt, lang) : tenant.trialEndsAt ? formatDate(tenant.trialEndsAt, lang) : "-"}
                    </td>
                    <td className="px-4 py-4 align-top text-slate-500">{formatDate(tenant.createdAt, lang)}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/admin/tenants/${tenant.id}`} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
                          <Eye size={14} />
                          {t.view}
                        </Link>
                        {canManageTenant ? (
                          <Link href={`/admin/tenants/${tenant.id}`} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
                            <Building2 size={14} />
                            {t.editTenant}
                          </Link>
                        ) : null}
                        {canManageBilling ? (
                          <Link href={`/admin/tenants/${tenant.id}?tab=billing`} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
                            <CreditCard size={14} />
                            {t.manageSubscription}
                          </Link>
                        ) : null}
                        {canManageBilling ? (
                          <Link href={`/admin/tenants/${tenant.id}/payment-methods`} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
                            <Settings size={14} />
                            {t.paymentMethods}
                          </Link>
                        ) : null}
                        {canImpersonate ? (
                          <button
                            type="button"
                            onClick={() => void handleImpersonate(tenant.id)}
                            disabled={busyTenantId === tenant.id || updateStatusMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60"
                          >
                            <UserCog size={14} />
                            {t.impersonateLogin}
                          </button>
                        ) : null}
                        {canManageTenant ? (
                          <button
                            type="button"
                            onClick={() => setConfirmTenant(tenant)}
                            disabled={busyTenantId === tenant.id || updateStatusMutation.isPending}
                            className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-white transition disabled:opacity-60 ${
                              tenant.isActive ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                          >
                            <Power size={14} />
                            {tenant.isActive ? t.deactivateTenant : t.activateTenant}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmTenant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">
              {confirmTenant.isActive ? t.deactivateTenant : t.activateTenant}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {confirmTenant.isActive ? t.disableTenantConfirm : t.enableTenantConfirm}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmTenant(null)} className="rounded-xl px-4 py-2 text-sm text-slate-600">
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleToggleStatus()}
                className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${confirmTenant.isActive ? "bg-rose-600" : "bg-emerald-600"}`}
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
