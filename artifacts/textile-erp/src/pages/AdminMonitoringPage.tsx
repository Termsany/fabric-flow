import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Database, RefreshCw, Users } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminSectionCard } from "@/components/admin/AdminSectionCard";
import { useLang } from "@/contexts/LangContext";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getAdminMonitoringOverview, type AdminMonitoringResponse } from "@/lib/admin-tenants";

export function AdminMonitoringPage() {
  const { t, lang } = useLang();
  const [data, setData] = useState<AdminMonitoringResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    setIsLoading(true);
    try {
      setData(await getAdminMonitoringOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Layout>
      <PageHeader
        title={t.monitoring}
        subtitle={t.monitoringSubtitle}
        action={(
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            {t.refreshData}
          </button>
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
          <div className="grid gap-4 xl:grid-cols-5">
            <AdminMetricCard label={t.tenants} value={formatNumber(data.summary.totalTenants, lang)} />
            <AdminMetricCard label={t.active} value={formatNumber(data.summary.activeTenants, lang)} tone="success" />
            <AdminMetricCard label={t.alerts} value={formatNumber(data.alerts.length, lang)} tone="danger" />
            <AdminMetricCard label={t.apiUsage} value={formatNumber(data.summary.apiRequestsLast7Days, lang)} tone="primary" />
            <AdminMetricCard label={t.storageUsage} value={`${formatNumber(data.summary.estimatedStorageGb, lang)} GB`} tone="warning" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <AdminSectionCard title={t.activityTimeline} action={<Activity size={18} className="text-slate-400" />}>
              {data.activityLogs.length === 0 ? (
                <AdminEmptyState title={t.noActivityTimeline} />
              ) : (
                <div className="space-y-3">
                  {data.activityLogs.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-medium text-slate-900">{entry.tenantName}</div>
                          <div className="text-xs text-slate-500">{entry.action} · {entry.entityType} #{entry.entityId}</div>
                        </div>
                        <div className="text-xs text-slate-500">{formatDateTime(entry.createdAt, lang)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AdminSectionCard>

            <AdminSectionCard title={t.alerts} action={<AlertTriangle size={18} className="text-slate-400" />}>
              {data.alerts.length === 0 ? (
                <AdminEmptyState title={t.noAlerts} />
              ) : (
                <div className="space-y-3">
                  {data.alerts.map((alert) => (
                    <div key={alert.id} className={`rounded-2xl border px-4 py-3 ${alert.severity === "high" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
                      <div className="font-medium text-slate-900">{alert.tenantName}</div>
                      <div className="mt-1 text-sm text-slate-600">{alert.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </AdminSectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <AdminSectionCard title={t.topActiveTenants} action={<Users size={18} className="text-slate-400" />}>
              {data.topActiveTenants.length === 0 ? (
                <AdminEmptyState title={t.noUsageYet} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-3 py-3 text-start font-medium">{t.companyName}</th>
                        <th className="px-3 py-3 text-start font-medium">{t.activityTimeline}</th>
                        <th className="px-3 py-3 text-start font-medium">{t.fabricRolls}</th>
                        <th className="px-3 py-3 text-start font-medium">{t.sales}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.topActiveTenants.map((tenant) => (
                        <tr key={tenant.id}>
                          <td className="px-3 py-3 font-medium text-slate-900">{tenant.name}</td>
                          <td className="px-3 py-3 text-slate-500">{formatNumber(tenant.activityCount, lang)}</td>
                          <td className="px-3 py-3 text-slate-500">{formatNumber(tenant.rollsCount, lang)}</td>
                          <td className="px-3 py-3 text-slate-500">{formatNumber(tenant.salesCount, lang)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminSectionCard>

            <AdminSectionCard title={t.systemLogs} action={<Database size={18} className="text-slate-400" />}>
              {data.systemLogs.length === 0 ? (
                <AdminEmptyState title={t.noSystemLogs} />
              ) : (
                <div className="space-y-3">
                  {data.systemLogs.map((entry) => (
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
          </div>
        </div>
      )}
    </Layout>
  );
}
