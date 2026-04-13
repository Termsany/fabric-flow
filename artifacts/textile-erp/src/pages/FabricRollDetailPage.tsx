import { useState, useEffect } from "react";
import { useParams } from "wouter";
import QRCode from "qrcode";
import { useLang } from "@/contexts/LangContext";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { FABRIC_ROLL_STATUSES } from "@/lib/workflow-statuses";
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

type FabricRollDetailView = {
  workflow?: {
    currentStatus: string;
    currentStage: string;
    nextStep: {
      action?: string | null;
      description?: string | null;
      route?: string | null;
    };
    allowedNextStatuses?: string[];
  };
  traceability?: {
    productionOrder?: {
      id: number;
      orderNumber: string;
      status: string;
    } | null;
    currentWarehouse?: {
      id: number;
      name: string;
      location: string;
    } | null;
    latestQc?: {
      id: number;
      result: string;
      defectCount: number;
      inspectedAt: string;
      notes?: string | null;
    } | null;
    latestMovement?: {
      id: number;
      fromWarehouseId?: number | null;
      toWarehouseId?: number | null;
      movedAt: string;
      reason?: string | null;
    } | null;
    latestDyeingOrder?: {
      id: number;
      orderNumber: string;
      status: string;
      targetColor: string;
    } | null;
    latestSalesOrder?: {
      id: number;
      orderNumber: string;
      status: string;
      customerId: number;
    } | null;
  };
  timeline?: {
    occurredAt: string;
    type: string;
    title: string;
    description?: string | null;
    status?: string | null;
    entityType: string;
    entityId: number;
  }[];
};

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

  const rollDetail = roll as typeof roll & FabricRollDetailView;
  const allowedStatusOptions = rollDetail.workflow?.allowedNextStatuses ?? FABRIC_ROLL_STATUSES;

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
              <StatusBadge status={rollDetail.status} />
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
                { label: "Current status", value: rollDetail.workflow?.currentStatus || rollDetail.status },
                { label: "Current stage", value: rollDetail.workflow?.currentStage || "—" },
                {
                  label: "Production order",
                  value: rollDetail.traceability?.productionOrder?.orderNumber || `#${rollDetail.productionOrderId}`,
                },
                {
                  label: "Warehouse",
                  value: rollDetail.traceability?.currentWarehouse
                    ? `${rollDetail.traceability.currentWarehouse.name} (${rollDetail.traceability.currentWarehouse.location})`
                    : "Unassigned",
                },
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
                disabled={allowedStatusOptions.length === 0}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{t.status}</option>
                {allowedStatusOptions.map((s) => (
                  <option key={s} value={s}>
                    {(t as unknown as Record<string, string>)[s] || s}
                  </option>
                ))}
              </select>
              <button
                disabled={!newStatus || updateRoll.isPending || allowedStatusOptions.length === 0}
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

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4">{t.rollNextStepTitle}</h3>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="text-sm font-semibold text-indigo-900">
                {rollDetail.workflow?.nextStep.action || t.rollNoImmediateAction}
              </div>
              <div className="mt-1 text-sm text-indigo-800">
                {rollDetail.workflow?.nextStep.description || t.rollNoPendingAction}
              </div>
              {rollDetail.workflow?.nextStep.route && (
                <div className="mt-3">
                  <Link href={rollDetail.workflow.nextStep.route}>
                    <button className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700">
                      {t.rollOpenNextStep}
                    </button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4">{t.rollTraceability}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-100 p-4">
                <div className="text-xs font-medium text-slate-400 mb-1">{t.rollLatestQc}</div>
                {rollDetail.traceability?.latestQc ? (
                  <>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={rollDetail.traceability.latestQc.result} />
                      <span className="text-xs text-slate-400">{formatDate(rollDetail.traceability.latestQc.inspectedAt, lang)}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-600">{t.rollDefectsLabel}: {rollDetail.traceability.latestQc.defectCount}</div>
                    {rollDetail.traceability.latestQc.notes && (
                      <div className="mt-1 text-sm text-slate-500">{rollDetail.traceability.latestQc.notes}</div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-slate-400">{t.rollNoQcReport}</div>
                )}
              </div>
              <div className="rounded-lg border border-slate-100 p-4">
                <div className="text-xs font-medium text-slate-400 mb-1">{t.rollLatestMovement}</div>
                {rollDetail.traceability?.latestMovement ? (
                  <>
                    <div className="text-sm text-slate-700">
                      #{rollDetail.traceability.latestMovement.fromWarehouseId || "—"} → #{rollDetail.traceability.latestMovement.toWarehouseId || "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{formatDate(rollDetail.traceability.latestMovement.movedAt, lang)}</div>
                    <div className="mt-2 text-sm text-slate-500">{rollDetail.traceability.latestMovement.reason || t.rollNoMovementReason}</div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400">{t.rollNoMovement}</div>
                )}
              </div>
              <div className="rounded-lg border border-slate-100 p-4">
                <div className="text-xs font-medium text-slate-400 mb-1">{t.rollLatestDyeing}</div>
                {rollDetail.traceability?.latestDyeingOrder ? (
                  <>
                    <div className="text-sm font-medium text-slate-700">{rollDetail.traceability.latestDyeingOrder.orderNumber}</div>
                    <div className="mt-1"><StatusBadge status={rollDetail.traceability.latestDyeingOrder.status} /></div>
                    <div className="mt-2 text-sm text-slate-500">{rollDetail.traceability.latestDyeingOrder.targetColor}</div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400">{t.rollNoDyeing}</div>
                )}
              </div>
              <div className="rounded-lg border border-slate-100 p-4">
                <div className="text-xs font-medium text-slate-400 mb-1">{t.rollLatestSales}</div>
                {rollDetail.traceability?.latestSalesOrder ? (
                  <>
                    <div className="text-sm font-medium text-slate-700">{rollDetail.traceability.latestSalesOrder.orderNumber}</div>
                    <div className="mt-1"><StatusBadge status={rollDetail.traceability.latestSalesOrder.status} /></div>
                    <div className="mt-2 text-sm text-slate-500">{t.rollCustomerLabel} #{rollDetail.traceability.latestSalesOrder.customerId}</div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400">{t.rollNoSales}</div>
                )}
              </div>
            </div>
          </div>

          {(rollDetail.timeline || []).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 mb-4">{t.rollTimelineTitle}</h3>
              <div className="space-y-4">
                {(rollDetail.timeline || []).map((event, index) => (
                  <div key={`${event.entityType}-${event.entityId}-${event.occurredAt}-${index}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="mt-1 h-3 w-3 rounded-full bg-indigo-500"></div>
                      {index < (rollDetail.timeline || []).length - 1 && (
                        <div className="mt-1 h-full min-h-10 w-px bg-slate-200"></div>
                      )}
                    </div>
                    <div className="flex-1 rounded-lg border border-slate-100 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-800">{event.title}</div>
                        <div className="text-xs text-slate-400">{formatDate(event.occurredAt, lang)}</div>
                      </div>
                      {event.status && (
                        <div className="mt-2"><StatusBadge status={event.status} /></div>
                      )}
                      {event.description && (
                        <div className="mt-2 text-sm text-slate-500">{event.description}</div>
                      )}
                      <div className="mt-2 text-xs text-slate-400">{event.entityType} #{event.entityId}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
