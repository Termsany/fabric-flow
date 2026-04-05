import { useState, useEffect } from "react";
import { useParams } from "wouter";
import QRCode from "qrcode";
import { useLang } from "@/contexts/LangContext";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useGetFabricRoll,
  useListQcReports,
  useListWarehouseMovements,
  useUpdateFabricRoll,
  getGetFabricRollQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { formatDate } from "@/lib/format";

const ROLL_STATUSES = [
  "CREATED", "IN_PRODUCTION", "QC_PENDING", "QC_PASSED", "QC_FAILED",
  "SENT_TO_DYEING", "IN_DYEING", "FINISHED", "IN_STOCK", "RESERVED", "SOLD",
];

export function FabricRollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang, isRTL } = useLang();
  const qc = useQueryClient();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [newStatus, setNewStatus] = useState("");

  const { data: roll, isLoading } = useGetFabricRoll(Number(id));
  const { data: qcReports } = useListQcReports({ fabricRollId: Number(id) });
  const { data: movements } = useListWarehouseMovements({ fabricRollId: Number(id) });

  const updateRoll = useUpdateFabricRoll({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetFabricRollQueryKey(Number(id)) }),
    },
  });

  useEffect(() => {
    if (roll?.qrCode) {
      QRCode.toDataURL(roll.qrCode, { width: 200, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => {});
    }
  }, [roll?.qrCode]);

  if (isLoading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48"></div>
          <div className="h-48 bg-slate-200 rounded-xl"></div>
        </div>
      </Layout>
    );
  }

  if (!roll) {
    return (
      <Layout>
        <div className="text-center py-20 text-slate-400">{t.noData}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/fabric-rolls">
          <button className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors mb-4">
            <ArrowLeft size={16} className={isRTL ? "rotate-180" : ""} />
            {t.fabricRolls}
          </button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{roll.rollCode}</h1>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={roll.status} />
              <span className="text-slate-500 text-sm">{roll.fabricType}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Package size={18} className="text-indigo-600" />
              {t.rollDetails}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: t.rollCode, value: roll.rollCode },
                { label: t.batchId, value: roll.batchId },
                { label: t.fabricType, value: roll.fabricType },
                { label: t.color, value: roll.color },
                { label: t.gsm, value: `${roll.gsm} GSM` },
                { label: t.width, value: `${roll.width} cm` },
                { label: t.length, value: `${roll.length} m` },
                { label: t.weight, value: `${roll.weight} kg` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs font-medium text-slate-400 mb-1">{label}</div>
                  <div className="text-sm text-slate-800 font-medium">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Update status */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4">{t.updateStatus}</h3>
            <div className="flex gap-3">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{t.status}</option>
                {ROLL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {(t as unknown as Record<string, string>)[s] || s}
                  </option>
                ))}
              </select>
              <button
                disabled={!newStatus || updateRoll.isPending}
                onClick={() => {
                  if (newStatus) {
                    updateRoll.mutate({ id: roll.id, data: { status: newStatus } });
                    setNewStatus("");
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {t.save}
              </button>
            </div>
          </div>

          {/* QC Reports */}
          {(qcReports || []).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                {t.qcReports}
              </h3>
              <div className="space-y-3">
                {(qcReports || []).map((report) => (
                  <div key={report.id} className="border border-slate-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <StatusBadge status={report.result} />
                      <span className="text-xs text-slate-400">{formatDate(report.inspectedAt, lang)}</span>
                    </div>
                    {report.defects && (
                      <div className="text-sm text-slate-600">
                        <span className="font-medium">{t.defects}:</span> {report.defects}
                      </div>
                    )}
                    <div className="text-sm text-slate-600">
                      <span className="font-medium">{t.defectCount}:</span> {report.defectCount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Movements */}
          {(movements || []).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 mb-4">{t.movements}</h3>
              <div className="space-y-2">
                {(movements || []).map((mov) => (
                  <div key={mov.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2">
                    <span className="text-slate-600">
                      {t.from} #{mov.fromWarehouseId || "—"} → {t.to} #{mov.toWarehouseId || "—"}
                    </span>
                    <span className="text-slate-400 text-xs">{formatDate(mov.movedAt, lang)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* QR Code */}
        <div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-center">
            <h3 className="text-base font-semibold text-slate-800 mb-4">{t.qrCode}</h3>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={roll.rollCode} className="mx-auto rounded-lg" />
            ) : (
              <div className="h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                {t.loading}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-2 font-mono">{roll.rollCode}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
