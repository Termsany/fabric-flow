import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Download, ImagePlus, QrCode, ReceiptText } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useLang } from "@/contexts/LangContext";
import { getBillingSubscription, listManualPayments, submitManualPayment } from "@/lib/billing";
import { getBillingPaymentMethodQr, getBillingPaymentMethods } from "@/lib/payment-methods";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

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

export function BillingPayPage() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [method, setMethod] = useState<"instapay" | "vodafone_cash">("instapay");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [error, setError] = useState("");

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["billing-subscription"],
    queryFn: getBillingSubscription,
  });

  const { data: payments } = useQuery({
    queryKey: ["billing-payments"],
    queryFn: listManualPayments,
  });

  const { data: billingMethods = [] } = useQuery({
    queryKey: ["billing-payment-methods"],
    queryFn: getBillingPaymentMethods,
  });

  const submitPayment = useMutation({
    mutationFn: submitManualPayment,
    onSuccess: async () => {
      setReferenceNumber("");
      setProofImage(null);
      setError("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["billing-payments"] }),
        qc.invalidateQueries({ queryKey: ["billing-subscription"] }),
        qc.invalidateQueries({ queryKey: ["billing-payment-methods"] }),
      ]);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    },
  });

  const handleSubmit = () => {
    if (!subscription) return;
    if (!referenceNumber.trim()) {
      setError(t.paymentReferenceNumber);
      return;
    }
    if (!proofImage) {
      setError(t.uploadPaymentProof);
      return;
    }

    const form = new FormData();
    form.append("method", effectiveMethod);
    form.append("amount", String(subscription.manualPayment.localAmountEgp));
    form.append("reference_number", referenceNumber.trim());
    form.append("proof_image", proofImage);
    submitPayment.mutate(form);
  };

  const instructions = subscription?.manualPayment.instructions;
  const activeMethods = billingMethods.length > 0
    ? billingMethods.map((item) => ({
        method: item.code,
        accountNumber: item.account_number,
        accountName: item.account_name,
        instructionsAr: item.instructions_ar,
      }))
    : subscription?.manualPayment.methods ?? [];
  const selectedMethodDetails = activeMethods.find((item) => item.method === method) ?? activeMethods[0] ?? null;

  const effectiveMethod = selectedMethodDetails?.method ?? method;
  const localCurrency = subscription?.manualPayment.localCurrency ?? "EGP";
  const manualPaymentDisplay = subscription ? getPrimaryAndSecondaryPrice({
    amount: subscription.manualPayment.amount,
    baseCurrency: subscription.manualPayment.baseCurrency,
    amountUsd: subscription.manualPayment.amountUsd,
    amountEgp: subscription.manualPayment.localAmountEgp,
  }) : null;
  const qrQuery = useQuery({
    queryKey: ["billing-payment-method-qr", effectiveMethod, subscription?.manualPayment.localAmountEgp ?? 0],
    queryFn: () => getBillingPaymentMethodQr(effectiveMethod, subscription?.manualPayment.localAmountEgp),
    enabled: Boolean(subscription && selectedMethodDetails),
  });

  const handleDownloadQr = () => {
    if (!qrQuery.data?.qrImageDataUrl) return;
    const link = document.createElement("a");
    link.href = qrQuery.data.qrImageDataUrl;
    link.download = `${effectiveMethod}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout>
      <PageHeader
        title={t.manualPayment}
        subtitle={t.paymentInstructions}
        action={<Link href="/billing" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">{t.back}</Link>}
      />

      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {isLoading || !subscription ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-3xl bg-slate-200" />
          <div className="h-80 animate-pulse rounded-3xl bg-slate-200" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t.paymentInstructions}</h2>
            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{t.choosePaymentMethod}</label>
                {activeMethods.length === 0 ? (
                  <AdminEmptyState title={t.noActivePaymentMethods} />
                ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {activeMethods.map((item) => (
                    <button
                      key={item.method}
                      type="button"
                      onClick={() => setMethod(item.method)}
                      className={`rounded-2xl border px-4 py-3 text-start transition ${effectiveMethod === item.method ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                    >
                      <div className="font-medium">{t[item.method]}</div>
                    </button>
                  ))}
                </div>
                )}
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">{t.amount}</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {manualPaymentDisplay ? formatCurrency(manualPaymentDisplay.primaryAmount, manualPaymentDisplay.primaryCurrency, lang) : "-"}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {manualPaymentDisplay ? formatCurrency(manualPaymentDisplay.secondaryAmount, manualPaymentDisplay.secondaryCurrency, lang) : "-"}
                </div>
                <div className="mt-3 text-sm text-slate-600">{t.accountNumber}: {selectedMethodDetails?.accountNumber || "-"}</div>
                <div className="mt-2 text-sm text-slate-600">{t.accountName}: {selectedMethodDetails?.accountName || "-"}</div>
                <div className="mt-2 text-sm text-slate-500">{selectedMethodDetails?.instructionsAr || "-"}</div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                      <QrCode size={16} />
                      {t.scanToPay}
                    </div>
                    {qrQuery.data ? (
                      <button type="button" onClick={handleDownloadQr} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
                        <Download size={14} />
                        {t.downloadQr}
                      </button>
                    ) : null}
                  </div>

                  {qrQuery.isLoading ? (
                    <div className="flex h-72 animate-pulse items-center justify-center rounded-2xl bg-slate-100" />
                  ) : qrQuery.error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                      {qrQuery.error instanceof Error ? qrQuery.error.message : t.failedToLoadData}
                    </div>
                  ) : qrQuery.data ? (
                    <div className="space-y-3">
                      <div className="flex justify-center rounded-2xl bg-slate-50 p-4">
                        <img
                          src={qrQuery.data.qrImageDataUrl}
                          alt={t.scanToPay}
                          className="h-64 w-64 max-w-full rounded-2xl border border-slate-200 bg-white p-2"
                        />
                      </div>
                      <div className="text-center text-xs text-slate-500">
                        {t.qrFallbackText}: {qrQuery.data.accountNumber} · {formatCurrency(qrQuery.data.amount, qrQuery.data.currency, lang)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t.payNow}</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{t.paymentReferenceNumber}</label>
                <input
                  value={referenceNumber}
                  onChange={(event) => setReferenceNumber(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
                  placeholder={lang === "ar" ? "أدخل رقم العملية" : "Enter transaction reference"}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{t.uploadPaymentProof}</label>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50">
                  <ImagePlus size={18} />
                  <span>{proofImage?.name || t.paymentProof}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => setProofImage(event.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitPayment.isPending || !selectedMethodDetails}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitPayment.isPending ? t.loading : t.payNow}
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ReceiptText size={18} className="text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">{t.payments}</h2>
        </div>
        {!payments || payments.length === 0 ? (
          <AdminEmptyState title={t.noPaymentsYet} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-start font-medium">{t.paymentMethod}</th>
                  <th className="px-3 py-3 text-start font-medium">{t.amount}</th>
                  <th className="px-3 py-3 text-start font-medium">{t.paymentReferenceNumber}</th>
                  <th className="px-3 py-3 text-start font-medium">{t.status}</th>
                  <th className="px-3 py-3 text-start font-medium">{t.date}</th>
                  <th className="px-3 py-3 text-start font-medium">{t.reviewer}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-3 py-3 text-slate-900">{t[payment.method]}</td>
                    <td className="px-3 py-3 text-slate-500">{formatCurrency(payment.amount, localCurrency, lang)}</td>
                    <td className="px-3 py-3 text-slate-500">{payment.referenceNumber}</td>
                    <td className="px-3 py-3"><StatusBadge status={payment.status} /></td>
                    <td className="px-3 py-3 text-slate-500">{formatDateTime(payment.createdAt, lang)}</td>
                    <td className="px-3 py-3 text-slate-500">{payment.reviewerName || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Layout>
  );
}
