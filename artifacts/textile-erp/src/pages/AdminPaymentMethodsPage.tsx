import { useMemo, useState } from "react";
import { Eye, RefreshCw, Settings2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { PaymentMethodFormModal } from "@/components/payment-methods/PaymentMethodFormModal";
import { ConfirmDialog } from "@/components/payment-methods/ConfirmDialog";
import { DataTable } from "@/components/payment-methods/DataTable";
import { StatCard } from "@/components/payment-methods/StatCard";
import { useLang } from "@/contexts/LangContext";
import {
  useAdminPaymentMethods,
  usePaymentMethodTenants,
  useUpdateAdminPaymentMethod,
} from "@/hooks/use-payment-methods";
import type { AdminPaymentMethodDefinition, PaymentMethodCode } from "@/lib/payment-methods";
import { formatDateTime, formatNumber } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export function AdminPaymentMethodsPage() {
  const { t, lang } = useLang();
  const { data: methods = [], isLoading, error, refetch } = useAdminPaymentMethods();
  const updateMutation = useUpdateAdminPaymentMethod();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<AdminPaymentMethodDefinition | null>(null);
  const [confirming, setConfirming] = useState<AdminPaymentMethodDefinition | null>(null);
  const [selectedCode, setSelectedCode] = useState<PaymentMethodCode | null>(null);
  const tenantsQuery = usePaymentMethodTenants(selectedCode);

  const labels = useMemo(() => ({
    globallyEnabled: t.globallyEnabled,
    enabled: t.enabled,
    accountNumber: t.accountNumber,
    accountName: t.accountName,
    instructions: t.instructions,
    nameAr: t.nameArabic,
    nameEn: t.nameEnglish,
    category: t.category,
    sortOrder: t.sortOrder,
    globallyDisabledHint: t.paymentMethodGloballyDisabled,
  }), [t]);

  const filtered = useMemo(() => methods.filter((method) => {
    const matchesSearch = !search.trim() || method.name_ar.includes(search.trim()) || method.name_en.toLowerCase().includes(search.trim().toLowerCase()) || method.code.includes(search.trim().toLowerCase());
    const matchesStatus = status === "all" || (status === "enabled" ? method.is_globally_enabled : !method.is_globally_enabled);
    return matchesSearch && matchesStatus;
  }), [methods, search, status]);

  const stats = useMemo(() => ({
    total: methods.length,
    enabled: methods.filter((item) => item.is_globally_enabled).length,
    disabled: methods.filter((item) => !item.is_globally_enabled).length,
    activations: methods.reduce((sum, item) => sum + item.tenants_count, 0),
  }), [methods]);

  const saveGlobalMethod = async (record: AdminPaymentMethodDefinition, form: Record<string, unknown>) => {
    await updateMutation.mutateAsync({
      code: record.code,
      payload: {
        name_ar: String(form.name_ar ?? ""),
        name_en: String(form.name_en ?? ""),
        category: String(form.category ?? "manual"),
        is_globally_enabled: Boolean(form.is_globally_enabled),
        supports_manual_review: true,
        sort_order: Number(form.sort_order ?? 0),
      },
    });
    toast({ title: t.saveChanges, description: t.paymentMethodUpdated });
    setEditing(null);
  };

  return (
    <Layout>
      <PageHeader
        title={t.paymentMethodsManagement}
        subtitle={t.globalPaymentMethodsSubtitle}
        action={(
          <button type="button" onClick={() => void refetch()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
            <RefreshCw size={16} />
            {t.refreshData}
          </button>
        )}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <StatCard label={t.totalMethods} value={formatNumber(stats.total, lang)} />
        <StatCard label={t.globallyEnabled} value={formatNumber(stats.enabled, lang)} tone="success" />
        <StatCard label={t.disabled} value={formatNumber(stats.disabled, lang)} tone="warning" />
        <StatCard label={t.totalTenantActivations} value={formatNumber(stats.activations, lang)} tone="primary" />
      </div>

      <div className="mb-6 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.6fr_1fr]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.searchPaymentMethods}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          <option value="all">{t.allStatuses}</option>
          <option value="enabled">{t.enabled}</option>
          <option value="disabled">{t.disabled}</option>
        </select>
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error instanceof Error ? error.message : t.failedToLoadData}</div> : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <AdminEmptyState title={t.noData} description={t.paymentMethodsManagement} />
          </div>
        ) : (
          <DataTable minWidth="980px">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t.name}</th>
                <th className="px-4 py-3 text-start font-medium">{t.code}</th>
                <th className="px-4 py-3 text-start font-medium">{t.globalStatus}</th>
                <th className="px-4 py-3 text-start font-medium">{t.usedByTenants}</th>
                <th className="px-4 py-3 text-start font-medium">{t.type}</th>
                <th className="px-4 py-3 text-start font-medium">{t.lastUpdated}</th>
                <th className="px-4 py-3 text-start font-medium">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((method) => (
                <tr key={method.code}>
                  <td className="px-4 py-4 font-medium text-slate-900">{lang === "ar" ? method.name_ar : method.name_en}</td>
                  <td className="px-4 py-4 text-slate-500">{method.code}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${method.is_globally_enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {method.is_globally_enabled ? t.enabled : t.disabled}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-500">{formatNumber(method.tenants_count, lang)}</td>
                  <td className="px-4 py-4 text-slate-500">{method.category}</td>
                  <td className="px-4 py-4 text-slate-500">{formatDateTime(method.updated_at, lang)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setSelectedCode(method.code)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                        <Eye size={14} />
                        {t.usedByTenants}
                      </button>
                      <button type="button" onClick={() => setEditing(method)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                        <Settings2 size={14} />
                        {t.edit}
                      </button>
                      <button type="button" onClick={() => setConfirming(method)} className={`rounded-xl px-3 py-2 text-xs font-medium text-white ${method.is_globally_enabled ? "bg-rose-600" : "bg-emerald-600"}`}>
                        {method.is_globally_enabled ? t.disable : t.enable}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>

      <PaymentMethodFormModal
        open={Boolean(editing)}
        mode="global"
        title={t.editGlobalPaymentMethod}
        saveLabel={t.saveChanges}
        cancelLabel={t.cancel}
        loading={updateMutation.isPending}
        record={editing}
        labels={labels}
        onClose={() => setEditing(null)}
        onSave={(form) => {
          if (!editing) return;
          void saveGlobalMethod(editing, form);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirming?.is_globally_enabled ? t.disable : t.enable}
        description={confirming?.is_globally_enabled ? t.disablePaymentMethodGlobalConfirm : t.enablePaymentMethodGlobalConfirm}
        confirmLabel={confirming?.is_globally_enabled ? t.disable : t.enable}
        cancelLabel={t.cancel}
        tone={confirming?.is_globally_enabled ? "danger" : "default"}
        loading={updateMutation.isPending}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming) return;
          void updateMutation.mutateAsync({
            code: confirming.code,
            payload: {
              name_ar: confirming.name_ar,
              name_en: confirming.name_en,
              category: confirming.category,
              is_globally_enabled: !confirming.is_globally_enabled,
              supports_manual_review: confirming.supports_manual_review,
              sort_order: confirming.sort_order,
            },
          }).then(() => {
            toast({ title: t.saveChanges, description: t.paymentMethodUpdated });
            setConfirming(null);
          });
        }}
      />

      {selectedCode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{t.usedByTenants}</h2>
              <button type="button" onClick={() => setSelectedCode(null)} className="rounded-xl px-3 py-2 text-sm text-slate-600">{t.close}</button>
            </div>
            {tenantsQuery.isLoading ? (
              <div className="grid gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : !tenantsQuery.data || tenantsQuery.data.length === 0 ? (
              <AdminEmptyState title={t.noData} />
            ) : (
              <div className="space-y-3">
                {tenantsQuery.data.map((tenant) => (
                  <div key={tenant.tenant_id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="font-medium text-slate-900">{tenant.tenant_name}</div>
                    <div className="text-xs text-slate-500">{formatDateTime(tenant.updated_at, lang)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
