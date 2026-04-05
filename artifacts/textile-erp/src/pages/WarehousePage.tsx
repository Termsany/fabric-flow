import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import {
  useListWarehouses,
  useCreateWarehouse,
  useListWarehouseMovements,
  useCreateWarehouseMovement,
  useListFabricRolls,
  getListWarehousesQueryKey,
  getListWarehouseMovementsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, ArrowRightLeft } from "lucide-react";
import { formatDate } from "@/lib/format";

export function WarehousePage() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [showCreateWarehouse, setShowCreateWarehouse] = useState(false);
  const [showMoveRoll, setShowMoveRoll] = useState(false);
  const [whForm, setWhForm] = useState({ name: "", location: "", capacity: "" });
  const [moveForm, setMoveForm] = useState({ fabricRollId: "", fromWarehouseId: "", toWarehouseId: "", reason: "" });

  const { data: warehouses, isLoading: whLoading, error: warehousesError } = useListWarehouses();
  const { data: movements, isLoading: movLoading, error: movementsError } = useListWarehouseMovements({});
  const { data: inStockRolls } = useListFabricRolls({ status: "IN_STOCK", limit: 200 });

  const createWarehouse = useCreateWarehouse({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListWarehousesQueryKey() });
        setShowCreateWarehouse(false);
        setWhForm({ name: "", location: "", capacity: "" });
      },
    },
  });

  const createMovement = useCreateWarehouseMovement({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListWarehouseMovementsQueryKey() });
        setShowMoveRoll(false);
        setMoveForm({ fabricRollId: "", fromWarehouseId: "", toWarehouseId: "", reason: "" });
      },
    },
  });

  const handleCreateWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    createWarehouse.mutate({
      data: {
        name: whForm.name,
        location: whForm.location,
        capacity: whForm.capacity ? parseInt(whForm.capacity) : undefined,
      },
    });
  };

  const handleMoveRoll = (e: React.FormEvent) => {
    e.preventDefault();
    createMovement.mutate({
      data: {
        fabricRollId: parseInt(moveForm.fabricRollId),
        fromWarehouseId: moveForm.fromWarehouseId ? parseInt(moveForm.fromWarehouseId) : undefined,
        toWarehouseId: parseInt(moveForm.toWarehouseId),
        reason: moveForm.reason || undefined,
      },
    });
  };

  return (
    <Layout>
      <PageHeader
        title={t.warehouse}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowMoveRoll(true)}
              className="flex items-center gap-2 border border-indigo-300 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <ArrowRightLeft size={16} />
              {t.moveRoll}
            </button>
            <button
              onClick={() => setShowCreateWarehouse(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              {t.createWarehouse}
            </button>
          </div>
        }
      />

      {(warehousesError || movementsError) && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t.failedToLoadData}
        </div>
      )}

      {/* Create Warehouse Modal */}
      {showCreateWarehouse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{t.createWarehouse}</h2>
              <button onClick={() => setShowCreateWarehouse(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateWarehouse} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.warehouseName}</label>
                <input type="text" value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.location}</label>
                <input type="text" value={whForm.location} onChange={(e) => setWhForm({ ...whForm, location: e.target.value })} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.capacity}</label>
                <input type="number" value={whForm.capacity} onChange={(e) => setWhForm({ ...whForm, capacity: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateWarehouse(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">{t.cancel}</button>
                <button type="submit" disabled={createWarehouse.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {createWarehouse.isPending ? t.loading : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Roll Modal */}
      {showMoveRoll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{t.moveRoll}</h2>
              <button onClick={() => setShowMoveRoll(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleMoveRoll} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.fabricRolls}</label>
                <select value={moveForm.fabricRollId} onChange={(e) => setMoveForm({ ...moveForm, fabricRollId: e.target.value })} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">{t.search}...</option>
                  {(inStockRolls || []).map((r) => (
                    <option key={r.id} value={r.id}>{r.rollCode} - {r.color}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.from}</label>
                <select value={moveForm.fromWarehouseId} onChange={(e) => setMoveForm({ ...moveForm, fromWarehouseId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">—</option>
                  {(warehouses || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.to}</label>
                <select value={moveForm.toWarehouseId} onChange={(e) => setMoveForm({ ...moveForm, toWarehouseId: e.target.value })} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">—</option>
                  {(warehouses || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.reason}</label>
                <input type="text" value={moveForm.reason} onChange={(e) => setMoveForm({ ...moveForm, reason: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowMoveRoll(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">{t.cancel}</button>
                <button type="submit" disabled={createMovement.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {createMovement.isPending ? t.loading : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {whLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse"></div>
          ))
        ) : (warehouses || []).length === 0 ? (
          <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">{t.noWarehousesYet}</div>
        ) : (
          (warehouses || []).map((wh) => (
            <div key={wh.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-slate-800">{wh.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${wh.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {wh.isActive ? t.active : t.inactive}
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-1">{wh.location}</p>
              {wh.capacity && (
                <p className="text-xs text-slate-400">{t.capacity}: {wh.capacity}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Movements */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">{t.movements}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.fabricRolls}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.from}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.to}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.reason}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.date}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                  ))}</tr>
                ))
              ) : (movements || []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">{t.noMovementsYet}</td></tr>
              ) : (
                (movements || []).map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">#{mov.fabricRollId}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{mov.fromWarehouseId ? `#${mov.fromWarehouseId}` : "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{mov.toWarehouseId ? `#${mov.toWarehouseId}` : "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{mov.reason || "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(mov.movedAt, lang)}</td>
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
