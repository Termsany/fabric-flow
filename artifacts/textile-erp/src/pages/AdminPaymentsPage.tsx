import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { approveAdminPayment, listAdminPayments, markAdminPaymentForReview, rejectAdminPayment, type AdminPaymentRow } from "@/lib/admin-tenants";
import { fetchProtectedAsset } from "@/lib/auth";
import { formatDateTime, formatNumber } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { hasPlatformAdminPermission } from "@/lib/roles";

export function AdminPaymentsPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null);

  const canReview = hasPlatformAdminPermission(user?.role, "billing.write");

  const load = async () => {
    setError("");
    setIsLoading(true);
    try {
      setPayments(await listAdminPayments({ status, method }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [method, status]);

  const runAction = async (paymentId: number, action: () => Promise<unknown>) => {
    setBusyId(paymentId);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    } finally {
      setBusyId(null);
    }
  };

  const openPreview = async (paymentId: number) => {
    setError("");
    setPreviewLoadingId(paymentId);
    try {
      if (previewImage?.startsWith("blob:")) {
        URL.revokeObjectURL(previewImage);
      }
      const objectUrl = await fetchProtectedAsset(`/api/admin/payments/${paymentId}/proof`);
      setPreviewImage(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    } finally {
      setPreviewLoadingId(null);
    }
  };

  return (
    <Layout>
      <PageHeader
        title={t.manualPayments}
        subtitle={t.adminBillingSubtitle}
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

      <div className="mb-6 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
        >
          <option value="all">{t.allStatuses}</option>
          <option value="pending">{t.pending}</option>
          <option value="pending_review">{t.pendingReview}</option>
          <option value="approved">{t.approved}</option>
          <option value="rejected">{t.rejected}</option>
        </select>

        <select
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
        >
          <option value="all">{t.allPaymentMethods}</option>
          <option value="instapay">{t.instapay}</option>
          <option value="vodafone_cash">{t.vodafone_cash}</option>
        </select>
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="p-6">
            <AdminEmptyState title={t.noPaymentsYet} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t.companyName}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.paymentMethod}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.amount}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.paymentReferenceNumber}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.status}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.paymentProof}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.date}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-4 font-medium text-slate-900">{payment.tenantName}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${payment.method === "instapay" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {t[payment.method]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-500">{formatNumber(payment.amount, lang)}</td>
                    <td className="px-4 py-4 text-slate-500">{payment.referenceNumber}</td>
                    <td className="px-4 py-4"><StatusBadge status={payment.status} /></td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => void openPreview(payment.id)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        {previewLoadingId === payment.id ? t.loading : t.previewImage}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-slate-500">{formatDateTime(payment.createdAt, lang)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {canReview ? (
                          <>
                            <button
                              type="button"
                              disabled={busyId === payment.id || !["pending", "pending_review"].includes(payment.status)}
                              onClick={() => void runAction(payment.id, () => approveAdminPayment(payment.id))}
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {t.approve}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === payment.id || payment.status === "approved"}
                              onClick={() => void runAction(payment.id, () => markAdminPaymentForReview(payment.id))}
                              className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {t.holdForReview}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === payment.id || !["pending", "pending_review"].includes(payment.status)}
                              onClick={() => void runAction(payment.id, () => rejectAdminPayment(payment.id))}
                              className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {t.reject}
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">{payment.reviewerName || "-"}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{t.previewImage}</h2>
              <button
                type="button"
                onClick={() => {
                  if (previewImage?.startsWith("blob:")) {
                    URL.revokeObjectURL(previewImage);
                  }
                  setPreviewImage(null);
                }}
                className="rounded-xl px-3 py-2 text-sm text-slate-600"
              >
                {t.close}
              </button>
            </div>
            <img src={previewImage} alt={t.paymentProof} className="max-h-[75vh] w-full rounded-2xl object-contain" />
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
