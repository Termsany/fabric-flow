import { useState } from "react";
import { Link } from "wouter";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useListDyeingOrders,
  useCreateDyeingOrder,
  useUpdateDyeingOrder,
  useListFabricRolls,
  getListDyeingOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { formatDate } from "@/lib/format";

export function DyeingPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRolls, setSelectedRolls] = useState<number[]>([]);
  const [form, setForm] = useState({ dyehouseName: "", targetColor: "", targetShade: "", notes: "" });

  const { data: orders, isLoading, error: ordersError } = useListDyeingOrders({});
  const { data: eligibleRolls, error: rollsError } = useListFabricRolls({ status: "QC_PASSED", limit: 200 });

  const createOrder = useCreateDyeingOrder({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDyeingOrdersQueryKey() });
        setShowCreate(false);
        setForm({ dyehouseName: "", targetColor: "", targetShade: "", notes: "" });
        setSelectedRolls([]);
      },
    },
  });

  const updateOrder = useUpdateDyeingOrder({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListDyeingOrdersQueryKey() }),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrder.mutate({
      data: {
        dyehouseName: form.dyehouseName,
        targetColor: form.targetColor,
        targetShade: form.targetShade || undefined,
        rollIds: selectedRolls,
        notes: form.notes || undefined,
      },
    });
  };

  const toggleRoll = (id: number) => {
    setSelectedRolls((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);
  };

  const accessError = [ordersError, rollsError].find(Boolean) as
    | {
        status?: number;
        data?: { error?: string; currentPlan?: string; requiredPlan?: string; billingStatus?: string };
        message?: string;
      }
    | undefined;

  const accessErrorMessage = (() => {
    if (!accessError) return null;
    if (accessError.status === 403) return t.featureRequiresPro;
    if (accessError.status === 402) return t.subscriptionInactiveMessage;
    return t.failedToLoadData;
  })();

  return (
    <Layout>
      <PageHeader
        title={t.dyeingOrders}
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            {t.createDyeingOrder}
          </button>
        }
      />

      {accessErrorMessage && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <div className="font-medium">{accessErrorMessage}</div>
          {accessError?.status === 403 && user?.role === "admin" && (
            <div className="mt-3">
              <Link href="/billing" className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700">
                {t.goToBilling}
              </Link>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{t.createDyeingOrder}</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.dyehouse}</label>
                <input
                  type="text"
                  value={form.dyehouseName}
                  onChange={(e) => setForm({ ...form, dyehouseName: e.target.value })}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.targetColor}</label>
                  <input
                    type="text"
                    value={form.targetColor}
                    onChange={(e) => setForm({ ...form, targetColor: e.target.value })}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.targetShade}</label>
                  <input
                    type="text"
                    value={form.targetShade}
                    onChange={(e) => setForm({ ...form, targetShade: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t.selectRolls} ({t.QC_PASSED})</label>
                <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {(eligibleRolls || []).length === 0 ? (
                    <div className="text-sm text-slate-400 text-center py-4">{t.noRolls}</div>
                  ) : (
                    (eligibleRolls || []).map((roll) => (
                      <label key={roll.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRolls.includes(roll.id)}
                          onChange={() => toggleRoll(roll.id)}
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        <span className="text-sm text-slate-700 font-mono">{roll.rollCode}</span>
                        <span className="text-xs text-slate-400">({roll.color})</span>
                      </label>
                    ))
                  )}
                </div>
                {selectedRolls.length > 0 && (
                  <p className="text-xs text-indigo-600 mt-1">{t.selectedRollsCount}: {selectedRolls.length}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.notes}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={createOrder.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {createOrder.isPending ? t.loading : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.orderNumber}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.dyehouse}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.targetColor}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.fabricRolls}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.status}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.sentAt}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                  ))}</tr>
                ))
              ) : accessErrorMessage ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">{accessErrorMessage}</td></tr>
              ) : (orders || []).length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">{t.noDyeingOrdersYet}</td></tr>
              ) : (
                (orders || []).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{order.dyehouseName}</td>
                    <td className="px-4 py-3 text-slate-600">{order.targetColor}</td>
                    <td className="px-4 py-3 text-slate-600">{(order.rollIds || []).length}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {order.sentAt ? formatDate(order.sentAt, lang) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                        <button
                          onClick={() => updateOrder.mutate({ id: order.id, data: { status: "COMPLETED", receivedAt: new Date().toISOString() } })}
                          className="text-green-600 hover:text-green-800 text-xs font-medium"
                        >
                          {t.COMPLETED}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
