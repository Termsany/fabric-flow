import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, CreditCard, KeyRound, ShieldUser, UserCog, X } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminSectionCard } from "@/components/admin/AdminSectionCard";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPlans } from "@/hooks/use-plans";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { resetTenantUserPasswordBySuperAdmin } from "@/lib/password";
import {
  adminTenantQueryKeys,
  extendAdminTenantTrial,
  getAdminTenantPaymentMethods,
  getAdminTenantDetails,
  impersonateTenantAdmin,
  syncAdminTenantBilling,
  updateAdminTenantPaymentMethod,
  updateAdminTenantBillingStatus,
  updateAdminTenantPlan,
  updateAdminTenantStatus,
  type AdminTenantDetails,
  type AdminTenantPaymentMethod,
} from "@/lib/admin-tenants";

function formatPlanLabel(plan: string, lang: string, planNames?: Map<string, { ar: string; en: string }>) {
  const customPlan = planNames?.get(plan);
  if (customPlan) {
    return lang === "ar" ? customPlan.ar : customPlan.en;
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

function BillingStatusSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <option value="trialing">Trialing</option>
      <option value="active">Active</option>
      <option value="past_due">Past Due</option>
      <option value="canceled">Canceled</option>
      <option value="unpaid">Unpaid</option>
      <option value="incomplete">Incomplete</option>
    </select>
  );
}

export function AdminTenantDetailPage() {
  const [, params] = useRoute("/admin/tenants/:id");
  const [, navigate] = useLocation();
  const { t, lang } = useLang();
  const { login, user } = useAuth();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.search).get("tab") || "overview");
  const [tenantPaymentMethods, setTenantPaymentMethods] = useState<AdminTenantPaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<AdminTenantPaymentMethod | null>(null);
  const [resetUser, setResetUser] = useState<AdminTenantDetails["users"][number] | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const tenantId = Number(params?.id);
  const { data: plans = [] } = useAdminPlans();
  const tenantQuery = useQuery({
    queryKey: adminTenantQueryKeys.detail(tenantId),
    queryFn: () => getAdminTenantDetails(tenantId),
    enabled: Number.isFinite(tenantId) && tenantId > 0,
  });
  const tenant = tenantQuery.data ?? null;
  const isLoading = tenantQuery.isLoading;

  const tabs = useMemo(() => [
    { key: "overview", label: t.tenantOverview },
    { key: "users", label: t.users },
    { key: "permissions", label: t.permissions },
    { key: "usage", label: t.usageStats },
    { key: "logs", label: t.activityTimeline },
    { key: "billing", label: t.billing },
  ], [t]);
  const canManageTenant = user?.role === "super_admin" || user?.role === "support_admin";
  const canManageBilling = user?.role === "super_admin";
  const canResetCompanyPassword = user?.role === "super_admin";
  const canImpersonate = canManageTenant;
  const planNames = useMemo(
    () =>
      new Map(
        plans.map((plan) => [plan.code, { ar: plan.nameAr, en: plan.nameEn }] as const),
      ),
    [plans],
  );
  const assignablePlans = useMemo(
    () =>
      plans
        .filter((plan) => plan.isActive || plan.code === tenant?.currentPlan)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [plans, tenant?.currentPlan],
  );

  useEffect(() => {
    if (tenantQuery.error) {
      setError(tenantQuery.error instanceof Error ? tenantQuery.error.message : t.failedToLoadData);
    }
  }, [t, tenantQuery.error]);

  useEffect(() => {
    if (activeTab !== "billing" || !Number.isFinite(tenantId) || tenantId <= 0) return;
    let cancelled = false;
    setPaymentMethodsLoading(true);
    void getAdminTenantPaymentMethods(tenantId)
      .then((methods) => {
        if (!cancelled) setTenantPaymentMethods(methods);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t.failedToLoadData);
      })
      .finally(() => {
        if (!cancelled) setPaymentMethodsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, tenantId, t]);

  const applyAction = async (action: () => Promise<unknown>, successMessage?: string) => {
    setIsUpdating(true);
    setError("");
    try {
      const result = await action();
      if (result && typeof result === "object" && "id" in result) {
        const payload = result as Partial<AdminTenantDetails> & {
          id: number;
          name?: string;
          isActive?: boolean;
          currentPlan?: string;
          billingStatus?: string;
          updatedAt?: string;
        };

        queryClient.setQueriesData(
          { queryKey: adminTenantQueryKeys.all },
          (current: AdminTenantDetails[] | AdminTenantDetails | undefined) => {
            if (!current) return current;
            if (Array.isArray(current)) {
              return current.map((entry: any) =>
                entry.id === payload.id
                  ? {
                      ...entry,
                      ...(payload.name ? { name: payload.name } : {}),
                      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
                      ...(payload.currentPlan ? { currentPlan: payload.currentPlan } : {}),
                      ...(payload.billingStatus ? { billingStatus: payload.billingStatus } : {}),
                      ...(payload.updatedAt ? { updatedAt: payload.updatedAt } : {}),
                    }
                  : entry,
              );
            }

            return current.id === payload.id
              ? {
                  ...current,
                  ...(payload.name ? { name: payload.name } : {}),
                  ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
                  ...(payload.currentPlan ? { currentPlan: payload.currentPlan } : {}),
                  ...(payload.billingStatus ? { billingStatus: payload.billingStatus } : {}),
                  ...(payload.updatedAt ? { updatedAt: payload.updatedAt } : {}),
                }
              : current;
          },
        );
      }

      await queryClient.invalidateQueries({ queryKey: adminTenantQueryKeys.detail(tenantId) });
      await queryClient.invalidateQueries({ queryKey: adminTenantQueryKeys.all });
      await queryClient.refetchQueries({ queryKey: adminTenantQueryKeys.all, type: "active" });
      if (successMessage) {
        setError(successMessage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImpersonate = async () => {
    if (!tenant) return;
    setIsUpdating(true);
    setError("");
    try {
      const data = await impersonateTenantAdmin(tenant.id);
      login(data as any);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    } finally {
      setIsUpdating(false);
    }
  };

  const saveTenantPaymentMethod = async (method: AdminTenantPaymentMethod) => {
    setIsUpdating(true);
    setError("");
    try {
      const updated = await updateAdminTenantPaymentMethod(tenantId, method.method, {
        is_active: method.tenantIsActive,
        account_number: method.accountNumber,
        account_name: method.accountName,
        instructions: method.instructionsAr,
        instructions_en: method.instructionsEn,
        metadata: method.metadata,
      });
      setTenantPaymentMethods((current) => current.map((item) => (item.method === updated.method ? updated : item)));
      setEditingPaymentMethod(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetTenantUserPassword = async () => {
    if (!resetUser) return;
    setIsUpdating(true);
    setError("");
    try {
      await resetTenantUserPasswordBySuperAdmin(tenantId, resetUser.id, { newPassword });
      setResetUser(null);
      setNewPassword("");
      setError(t.passwordChanged);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title={tenant?.name || t.tenantDetails}
        subtitle={t.adminOverview}
        action={(
          <button
            type="button"
            onClick={() => navigate("/admin/tenants")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            {t.back}
          </button>
        )}
      />

      {error ? (
        <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${error === t.planUpdated || error === t.trialExtended || error === t.billingStatusUpdated || error === t.impersonationStarted ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : !tenant ? (
        <AdminEmptyState title={t.noData} description={t.failedToLoadData} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <AdminMetricCard label={t.users} value={formatNumber(tenant.usage.usersCount, lang)} />
            <AdminMetricCard label={t.activeUsers} value={formatNumber(tenant.usage.activeUsersCount, lang)} tone="success" />
            <AdminMetricCard label={t.fabricRolls} value={formatNumber(tenant.usage.rollsCount, lang)} tone="primary" />
            <AdminMetricCard label={t.currentPlan} value={formatPlanLabel(tenant.currentPlan, lang, planNames)} tone="warning" />
          </div>

          <AdminTabs items={tabs} value={activeTab} onChange={setActiveTab} />

          {activeTab === "overview" ? (
            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <AdminSectionCard title={t.companyInfo} subtitle={t.tenantOverview}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { label: t.companyName, value: tenant.name },
                    { label: t.status, value: tenant.isActive ? t.active : t.inactive },
                    { label: t.createdAt, value: formatDate(tenant.createdAt, lang) },
                    { label: t.company, value: tenant.country },
                    { label: t.plan, value: formatPlanLabel(tenant.currentPlan, lang, planNames) },
                    { label: t.subscriptionStatus, value: tenant.billingStatus },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-500">{item.label}</div>
                      <div className="mt-1 font-medium text-slate-900">{item.value}</div>
                    </div>
                  ))}
                </div>
              </AdminSectionCard>

              <AdminSectionCard
                title={t.adminActions}
                subtitle={t.subscriptionManagedInBilling}
                action={<ShieldUser size={18} className="text-slate-400" />}
              >
                <div className="flex flex-wrap gap-3">
                  {canManageTenant ? (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => void applyAction(() => updateAdminTenantStatus(tenant.id, !tenant.isActive))}
                      className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${tenant.isActive ? "bg-rose-600" : "bg-emerald-600"} disabled:opacity-60`}
                    >
                      {tenant.isActive ? t.deactivateTenant : t.activateTenant}
                    </button>
                  ) : null}
                  {canImpersonate ? (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => void handleImpersonate()}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      <UserCog size={16} />
                      {t.impersonateLogin}
                    </button>
                  ) : null}
                </div>
              </AdminSectionCard>
            </div>
          ) : null}

          {activeTab === "users" ? (
            <AdminSectionCard title={t.userDirectory} subtitle={`${formatNumber(tenant.users.length, lang)} ${t.users}`}>
              {tenant.users.length === 0 ? (
                <AdminEmptyState title={t.noData} description={t.userDirectory} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-3 py-3 text-start font-medium">{t.fullName}</th>
                        <th className="px-3 py-3 text-start font-medium">{t.email}</th>
                        <th className="px-3 py-3 text-start font-medium">{t.role}</th>
                        <th className="px-3 py-3 text-start font-medium">{t.status}</th>
                        {canResetCompanyPassword ? <th className="px-3 py-3 text-start font-medium">{t.actions}</th> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tenant.users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-3 py-3 font-medium text-slate-900">{user.fullName}</td>
                          <td className="px-3 py-3 text-slate-500">{user.email}</td>
                          <td className="px-3 py-3 text-slate-500">{(t.roles as Record<string, string>)[user.role] || user.role}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                              {user.isActive ? t.active : t.inactive}
                            </span>
                          </td>
                          {canResetCompanyPassword ? (
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setResetUser(user);
                                  setNewPassword("");
                                  setError("");
                                }}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                              >
                                <KeyRound size={14} />
                                {t.resetPassword}
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminSectionCard>
          ) : null}

          {activeTab === "permissions" ? (
            <AdminSectionCard title={t.permissions} subtitle={t.tenantPermissionsSummary}>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-medium text-slate-900">{t.planFeatures}</div>
                  <div className="grid gap-2">
                    {Object.entries(tenant.permissions.features).map(([key, enabled]) => (
                      <div key={key} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                        <span className="text-sm text-slate-700">{key}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {enabled ? t.active : t.inactive}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-medium text-slate-900">{t.usage}</div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span className="text-sm text-slate-700">{t.usersLimit}</span>
                      <span className="font-medium text-slate-900">{tenant.permissions.limits.users ?? t.unlimited}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span className="text-sm text-slate-700">{t.warehousesLimit}</span>
                      <span className="font-medium text-slate-900">{tenant.permissions.limits.warehouses ?? t.unlimited}</span>
                    </div>
                  </div>
                </div>
              </div>
            </AdminSectionCard>
          ) : null}

          {activeTab === "usage" ? (
            <AdminSectionCard title={t.usageStats}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: t.users, value: tenant.usage.usersCount },
                  { label: t.activeUsers, value: tenant.usage.activeUsersCount },
                  { label: t.warehouse, value: tenant.usage.warehousesCount },
                  { label: t.fabricRolls, value: tenant.usage.rollsCount },
                  { label: t.inStock, value: tenant.usage.inStockRolls },
                  { label: t.reserved, value: tenant.usage.reservedRolls },
                  { label: t.sold, value: tenant.usage.soldRolls },
                  { label: t.productionOrders, value: tenant.usage.activeProductionOrders },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-500">{item.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(item.value, lang)}</div>
                  </div>
                ))}
              </div>
            </AdminSectionCard>
          ) : null}

          {activeTab === "logs" ? (
            <AdminSectionCard title={t.activityTimeline}>
              {tenant.logs.length === 0 ? (
                <AdminEmptyState title={t.noActivityTimeline} />
              ) : (
                <div className="space-y-3">
                  {tenant.logs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-medium text-slate-900">{log.action}</div>
                          <div className="text-xs text-slate-500">{log.entityType} #{log.entityId}</div>
                        </div>
                        <div className="text-xs text-slate-500">{formatDateTime(log.createdAt, lang)}</div>
                      </div>
                      <div className="mt-2 text-sm text-slate-600">{log.userName || t.user}</div>
                    </div>
                  ))}
                </div>
              )}
            </AdminSectionCard>
          ) : null}

          {activeTab === "billing" ? (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <AdminSectionCard
                  title={t.subscriptionInfo}
                  action={<CreditCard size={18} className="text-slate-400" />}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs text-slate-500">{t.currentPlan}</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">{formatPlanLabel(tenant.currentPlan, lang)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs text-slate-500">{t.subscriptionStatus}</div>
                      <div className="mt-2"><StatusBadge status={tenant.billingStatus === "canceled" ? "CANCELLED" : tenant.billingStatus} /></div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs text-slate-500">{t.renewalDate}</div>
                      <div className="mt-1 font-medium text-slate-900">{tenant.subscriptionEndsAt ? formatDate(tenant.subscriptionEndsAt, lang) : "-"}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs text-slate-500">{t.lastInvoice}</div>
                      <div className="mt-1 font-medium text-slate-900">{tenant.invoiceHistory[0]?.status || tenant.billingActionLogs[0]?.action || "-"}</div>
                    </div>
                  </div>
                </AdminSectionCard>

                <AdminSectionCard title={t.invoiceHistory}>
                  {tenant.invoiceHistory.length === 0 ? (
                    <AdminEmptyState title={t.noInvoicesYet} />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="px-3 py-3 text-start font-medium">{t.invoiceNumber}</th>
                            <th className="px-3 py-3 text-start font-medium">{t.totalAmount}</th>
                            <th className="px-3 py-3 text-start font-medium">{t.status}</th>
                            <th className="px-3 py-3 text-start font-medium">{t.date}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tenant.invoiceHistory.map((invoice) => (
                            <tr key={invoice.id}>
                              <td className="px-3 py-3 font-medium text-slate-900">{invoice.invoiceNumber}</td>
                              <td className="px-3 py-3 text-slate-500">{formatNumber(invoice.amount, lang)} {invoice.currency}</td>
                              <td className="px-3 py-3 text-slate-500">{invoice.status}</td>
                              <td className="px-3 py-3 text-slate-500">{formatDate(invoice.issuedAt, lang)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </AdminSectionCard>

                <AdminSectionCard title={t.billingActionLogsTitle}>
                  {tenant.billingActionLogs.length === 0 ? (
                    <AdminEmptyState title={t.noSystemLogs} />
                  ) : (
                    <div className="space-y-3">
                      {tenant.billingActionLogs.map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="font-medium text-slate-900">{entry.action}</div>
                              <div className="text-xs text-slate-500">{entry.adminEmail} · {(t.roles as Record<string, string>)[entry.adminRole] || entry.adminRole}</div>
                            </div>
                            <div className="text-xs text-slate-500">{formatDateTime(entry.createdAt, lang)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AdminSectionCard>

                <AdminSectionCard title={t.tenantPaymentMethods} subtitle={t.tenantPaymentMethodsSubtitle}>
                  {paymentMethodsLoading ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {Array.from({ length: 2 }).map((_, index) => (
                        <div key={index} className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white" />
                      ))}
                    </div>
                  ) : tenantPaymentMethods.length === 0 ? (
                    <AdminEmptyState title={t.noActivePaymentMethods} />
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {tenantPaymentMethods.map((method) => (
                        <div key={method.method} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-900">{t[method.method]}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${method.globalIsActive ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                                  {method.globalIsActive ? t.globallyEnabled : t.globallyDisabled}
                                </div>
                                <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${method.tenantIsActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                                  {method.tenantIsActive ? t.enabled : t.disabled}
                                </div>
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
                              disabled={isUpdating || !canManageBilling || (!method.globalIsActive && !method.tenantIsActive)}
                              onClick={() => void saveTenantPaymentMethod({ ...method, tenantIsActive: !method.tenantIsActive, isActive: method.globalIsActive && !method.tenantIsActive })}
                              className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${method.tenantIsActive ? "bg-rose-600" : "bg-emerald-600"}`}
                            >
                              {method.tenantIsActive ? t.disabled : t.enabled}
                            </button>
                            <button
                              type="button"
                              disabled={!canManageBilling}
                              onClick={() => setEditingPaymentMethod({ ...method })}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                            >
                              {t.edit}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AdminSectionCard>
              </div>

              <div className="space-y-6">
                <AdminSectionCard title={t.manualActions} subtitle={t.manageTenantSubscription}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500">{t.changePlan}</div>
                      <div className="flex flex-wrap gap-2">
                        {assignablePlans.map((plan) => (
                          <button
                            key={plan.id}
                            type="button"
                            disabled={isUpdating || !canManageBilling}
                            onClick={() => void applyAction(() => updateAdminTenantPlan(tenant.id, plan.code), t.planUpdated)}
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                              tenant.currentPlan === plan.code ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-700"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {lang === "ar" ? plan.nameAr : plan.nameEn}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-slate-500">{t.subscriptionStatus}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <BillingStatusSelect
                          value={tenant.billingStatus}
                          disabled={isUpdating || !canManageBilling}
                          onChange={(value) => void applyAction(() => updateAdminTenantBillingStatus(tenant.id, value), t.billingStatusUpdated)}
                        />
                        <button
                          type="button"
                          disabled={isUpdating || !canManageBilling}
                          onClick={() => void applyAction(() => extendAdminTenantTrial(tenant.id, 14), t.trialExtended)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {t.extendTrial}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isUpdating || !canManageBilling}
                        onClick={() => void applyAction(() => updateAdminTenantBillingStatus(tenant.id, "canceled", false), t.billingStatusUpdated)}
                        className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t.suspendTenant}
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating || !canManageBilling}
                        onClick={() => void applyAction(() => updateAdminTenantBillingStatus(tenant.id, "active", true), t.billingStatusUpdated)}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t.reactivateTenant}
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating || !canManageBilling}
                        onClick={() => void applyAction(() => syncAdminTenantBilling(tenant.id), t.billingStatusUpdated)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t.syncStripeMetadata}
                      </button>
                    </div>
                  </div>
                </AdminSectionCard>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {editingPaymentMethod ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">{t.editTenantPaymentMethod}</h2>
            <div className="mt-5 space-y-4">
              {!editingPaymentMethod.globalIsActive ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {t.paymentMethodGloballyDisabled}
                </div>
              ) : null}
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span>{t.enabledForTenant}</span>
                <input
                  type="checkbox"
                  checked={editingPaymentMethod.tenantIsActive}
                  disabled={!editingPaymentMethod.globalIsActive}
                  onChange={(event) => setEditingPaymentMethod({
                    ...editingPaymentMethod,
                    tenantIsActive: event.target.checked,
                    isActive: editingPaymentMethod.globalIsActive && event.target.checked,
                  })}
                />
              </label>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{t.accountNumber}</label>
                <input
                  value={editingPaymentMethod.accountNumber}
                  onChange={(event) => setEditingPaymentMethod({ ...editingPaymentMethod, accountNumber: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{t.accountName}</label>
                <input
                  value={editingPaymentMethod.accountName}
                  onChange={(event) => setEditingPaymentMethod({ ...editingPaymentMethod, accountName: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{t.paymentInstructions}</label>
                <textarea
                  value={editingPaymentMethod.instructionsAr}
                  onChange={(event) => setEditingPaymentMethod({ ...editingPaymentMethod, instructionsAr: event.target.value })}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingPaymentMethod(null)} className="rounded-xl px-4 py-2 text-sm text-slate-600">
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => void saveTenantPaymentMethod(editingPaymentMethod)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {t.saveChanges}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resetUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{t.resetPasswordForUser}</h2>
                <p className="mt-1 text-sm text-slate-500">{resetUser.fullName}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetUser(null);
                  setNewPassword("");
                }}
                className="text-slate-400 transition hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{t.newPassword}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
                />
              </div>
              <p className="text-sm text-slate-500">{t.strongPasswordHint}</p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setResetUser(null);
                    setNewPassword("");
                  }}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => void handleResetTenantUserPassword()}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isUpdating ? t.loading : t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
