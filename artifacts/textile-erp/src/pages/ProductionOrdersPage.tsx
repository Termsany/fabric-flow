import { useState } from "react";
import { Link } from "wouter";
import { useLang } from "@/contexts/LangContext";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useListProductionOrders,
  useCreateProductionOrder,
  getListProductionOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Eye, X } from "lucide-react";
import { formatDate } from "@/lib/format";

export function ProductionOrdersPage() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    fabricType: "",
    gsm: "",
    width: "",
    rawColor: "",
    quantity: "",
    notes: "",
  });

  const normalizedSearch = search.trim();
  const { data: orders, isLoading } = useListProductionOrders(normalizedSearch ? { search: normalizedSearch } : {});

  const createOrder = useCreateProductionOrder({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProductionOrdersQueryKey() });
        setShowCreate(false);
        setForm({ fabricType: "", gsm: "", width: "", rawColor: "", quantity: "", notes: "" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrder.mutate({
      data: {
        fabricType: form.fabricType,
        gsm: parseFloat(form.gsm),
        width: parseFloat(form.width),
        rawColor: form.rawColor,
        quantity: parseInt(form.quantity),
        notes: form.notes || undefined,
      },
    });
  };

  return (
    <Layout>
      <PageHeader
        title={t.productionOrders}
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            {t.createOrder}
          </button>
        }
      />

      <div className="mb-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`${t.search} ${t.orderNumber} / ID...`}
          className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{t.createOrder}</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "fabricType", label: t.fabricType, type: "text" },
                  { key: "rawColor", label: t.rawColor, type: "text" },
                  { key: "gsm", label: t.gsm, type: "number" },
                  { key: "width", label: t.width, type: "number" },
                  { key: "quantity", label: t.quantity, type: "number" },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                    <input
                      type={type}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      required
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))}
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
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={createOrder.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
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
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.fabricType}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.rawColor}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.gsm}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.quantity}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.rollsGenerated}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.status}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.date}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : (orders || []).length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div>{t.noOrders}</div>
                      <div className="text-xs text-slate-500">{t.emptyProductionOrdersHint}</div>
                      <button
                        type="button"
                        onClick={() => setShowCreate(true)}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {t.emptyProductionOrdersCta}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                (orders || []).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{order.fabricType}</td>
                    <td className="px-4 py-3 text-slate-600">{order.rawColor}</td>
                    <td className="px-4 py-3 text-slate-600">{order.gsm}</td>
                    <td className="px-4 py-3 text-slate-600">{order.quantity}</td>
                    <td className="px-4 py-3 text-slate-600">{order.rollsGenerated}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(order.createdAt, lang)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/production-orders/${order.id}`}>
                        <button className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-xs font-medium">
                          <Eye size={14} />
                          {t.view}
                        </button>
                      </Link>
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
