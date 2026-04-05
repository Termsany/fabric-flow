import { useEffect, useState } from "react";
import type { AdminPaymentMethodDefinition, TenantPaymentMethodRecord } from "@/lib/payment-methods";

type Mode = "global" | "tenant";

interface PaymentMethodFormModalProps {
  open: boolean;
  mode: Mode;
  title: string;
  saveLabel: string;
  cancelLabel: string;
  loading?: boolean;
  record: AdminPaymentMethodDefinition | TenantPaymentMethodRecord | null;
  labels: {
    globallyEnabled: string;
    enabled: string;
    accountNumber: string;
    accountName: string;
    instructions: string;
    nameAr: string;
    nameEn: string;
    category: string;
    sortOrder: string;
    globallyDisabledHint: string;
  };
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}

export function PaymentMethodFormModal({
  open,
  mode,
  title,
  saveLabel,
  cancelLabel,
  loading = false,
  record,
  labels,
  onClose,
  onSave,
}: PaymentMethodFormModalProps) {
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!record) return;
    if (mode === "global") {
      const globalRecord = record as AdminPaymentMethodDefinition;
      setForm({
        name_ar: globalRecord.name_ar,
        name_en: globalRecord.name_en,
        category: globalRecord.category,
        is_globally_enabled: globalRecord.is_globally_enabled,
        supports_manual_review: globalRecord.supports_manual_review,
        sort_order: globalRecord.sort_order,
      });
    } else {
      const tenantRecord = record as TenantPaymentMethodRecord;
      setForm({
        is_active: tenantRecord.is_active,
        account_number: tenantRecord.account_number,
        account_name: tenantRecord.account_name,
        instructions_ar: tenantRecord.instructions_ar,
        instructions_en: tenantRecord.instructions_en,
      });
    }
  }, [mode, record]);

  if (!open || !record) return null;

  const isGloballyEnabled = mode === "tenant" ? (record as TenantPaymentMethodRecord).is_globally_enabled : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <div className="mt-5 space-y-4">
          {mode === "global" ? (
            <>
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span>{labels.globallyEnabled}</span>
                <input
                  type="checkbox"
                  checked={Boolean(form.is_globally_enabled)}
                  onChange={(event) => setForm((current) => ({ ...current, is_globally_enabled: event.target.checked }))}
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">{labels.nameAr}</label>
                  <input value={String(form.name_ar ?? "")} onChange={(event) => setForm((current) => ({ ...current, name_ar: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">{labels.nameEn}</label>
                  <input value={String(form.name_en ?? "")} onChange={(event) => setForm((current) => ({ ...current, name_en: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">{labels.category}</label>
                  <input value={String(form.category ?? "manual")} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">{labels.sortOrder}</label>
                  <input type="number" value={Number(form.sort_order ?? 0)} onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700" />
                </div>
              </div>
            </>
          ) : (
            <>
              {!isGloballyEnabled ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {labels.globallyDisabledHint}
                </div>
              ) : null}
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span>{labels.enabled}</span>
                <input
                  type="checkbox"
                  checked={Boolean(form.is_active)}
                  disabled={!isGloballyEnabled}
                  onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                />
              </label>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{labels.accountNumber}</label>
                <input value={String(form.account_number ?? "")} onChange={(event) => setForm((current) => ({ ...current, account_number: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{labels.accountName}</label>
                <input value={String(form.account_name ?? "")} onChange={(event) => setForm((current) => ({ ...current, account_name: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{labels.instructions}</label>
                <textarea value={String(form.instructions_ar ?? "")} onChange={(event) => setForm((current) => ({ ...current, instructions_ar: event.target.value }))} rows={4} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700" />
              </div>
            </>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-600">
            {cancelLabel}
          </button>
          <button type="button" onClick={() => onSave(form)} disabled={loading} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
