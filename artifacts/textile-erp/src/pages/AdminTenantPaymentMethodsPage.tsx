import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { CreditCard } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { ConfirmDialog } from "@/components/payment-methods/ConfirmDialog";
import { PaymentMethodFormModal } from "@/components/payment-methods/PaymentMethodFormModal";
import { useLang } from "@/contexts/LangContext";
import { useAdminTenantPaymentMethods, useUpdateAdminTenantPaymentMethod } from "@/hooks/use-payment-methods";
import { getAdminTenantDetails } from "@/lib/admin-tenants";
import type { TenantPaymentMethodRecord } from "@/lib/payment-methods";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export function AdminTenantPaymentMethodsPage() {
  const [, params] = useRoute("/admin/tenants/:id/payment-methods");
  const tenantId = Number(params?.id);
  const { t, lang } = useLang();
  const tenantQuery = useQuery({
    queryKey: ["admin-tenant-header", tenantId],
    queryFn: () => getAdminTenantDetails(tenantId),
    enabled: tenantId > 0,
  });
  const { data: methods = [], isLoading, error } = useAdminTenantPaymentMethods(tenantId);
  const updateMutation = useUpdateAdminTenantPaymentMethod(tenantId);
  const [editing, setEditing] = useState<TenantPaymentMethodRecord | null>(null);
  const [confirming, setConfirming] = useState<TenantPaymentMethodRecord | null>(null);

  const labels = useMemo(() => ({
    globallyEnabled: t.globallyEnabled,
    enabled: t.enabledForTenant,
    accountNumber: t.accountNumber,
    accountName: t.accountName,
    instructions: t.instructions,
    nameAr: t.nameArabic,
    nameEn: t.nameEnglish,
    category: t.category,
    sortOrder: t.sortOrder,
    globallyDisabledHint: t.paymentMethodGloballyDisabled,
  }), [t]);

  return (
    <Layout>
      <PageHeader
        title={t.paymentMethodsManagement}
        subtitle={tenantQuery.data?.name || t.tenantDetails}
        action={<Link href={`/admin/tenants/${tenantId}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">{t.back}</Link>}
      />

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs text-slate-500">{t.companyName}</div>
        <div className="mt-1 text-lg font-semibold text-slate-900">{tenantQuery.data?.name || "-"}</div>
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error instanceof Error ? error.message : t.failedToLoadData}</div> : null}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : methods.length === 0 ? (
        <AdminEmptyState title={t.noData} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {methods.map((method) => (
            <div key={method.code} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{lang === "ar" ? method.name_ar : method.name_en}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${method.is_globally_enabled ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                      {method.is_globally_enabled ? t.globallyEnabled : t.globallyDisabled}
                    </span>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${method.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {method.is_active ? t.enabled : t.disabled}
                    </span>
                  </div>
                </div>
                <CreditCard size={18} className="text-slate-400" />
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">{t.accountNumber}</div>
                  <div className="mt-1 text-slate-900">{method.account_number || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t.accountName}</div>
                  <div className="mt-1 text-slate-900">{method.account_name || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t.lastUpdated}</div>
                  <div className="mt-1 text-slate-900">{formatDateTime(method.updated_at, lang)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t.updatedBy}</div>
                  <div className="mt-1 text-slate-900">{method.updated_by_name || "-"}</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={updateMutation.isPending || (!method.is_globally_enabled && !method.is_active)}
                  onClick={() => setConfirming(method)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${method.is_active ? "bg-rose-600" : "bg-emerald-600"}`}
                >
                  {method.is_active ? t.deactivate : t.activate}
                </button>
                <button type="button" onClick={() => setEditing(method)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                  {t.edit}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaymentMethodFormModal
        open={Boolean(editing)}
        mode="tenant"
        title={t.editTenantPaymentMethod}
        saveLabel={t.saveChanges}
        cancelLabel={t.cancel}
        loading={updateMutation.isPending}
        record={editing}
        labels={labels}
        onClose={() => setEditing(null)}
        onSave={(form) => {
          if (!editing) return;
          void updateMutation.mutateAsync({
            code: editing.code,
            payload: {
              is_active: Boolean(form.is_active),
              account_number: String(form.account_number ?? ""),
              account_name: String(form.account_name ?? ""),
              instructions_ar: String(form.instructions_ar ?? ""),
              instructions_en: "",
              metadata: editing.metadata,
            },
          }).then(() => {
            toast({ title: t.saveChanges, description: t.paymentMethodUpdated });
            setEditing(null);
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirming?.is_active ? t.deactivate : t.activate}
        description={confirming?.is_active ? t.disablePaymentMethodConfirm : t.enablePaymentMethodConfirm}
        confirmLabel={confirming?.is_active ? t.deactivate : t.activate}
        cancelLabel={t.cancel}
        tone={confirming?.is_active ? "danger" : "default"}
        loading={updateMutation.isPending}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming) return;
          void updateMutation.mutateAsync({
            code: confirming.code,
            payload: {
              is_active: !confirming.is_active,
              account_number: confirming.account_number,
              account_name: confirming.account_name,
              instructions_ar: confirming.instructions_ar,
              instructions_en: confirming.instructions_en,
              metadata: confirming.metadata,
            },
          }).then(() => {
            toast({ title: t.saveChanges, description: t.paymentMethodUpdated });
            setConfirming(null);
          });
        }}
      />
    </Layout>
  );
}
