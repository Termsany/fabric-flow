import { useParams, Link } from "wouter";
import { useLang } from "@/contexts/LangContext";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { useGetProductionOrder, useListFabricRolls } from "@workspace/api-client-react";
import { ArrowLeft } from "lucide-react";

export function ProductionOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, isRTL } = useLang();

  const { data: order, isLoading } = useGetProductionOrder(Number(id));
  const { data: rolls } = useListFabricRolls({ productionOrderId: Number(id), limit: 200 });

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

  if (!order) return <Layout><div className="text-center py-20 text-slate-400">{t.noData}</div></Layout>;

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/production-orders">
          <button className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors mb-4">
            <ArrowLeft size={16} className={isRTL ? "rotate-180" : ""} />
            {t.productionOrders}
          </button>
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900 font-mono">{order.orderNumber}</h1>
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: t.fabricType, value: order.fabricType },
          { label: t.rawColor, value: order.rawColor },
          { label: t.gsm, value: `${order.gsm} GSM` },
          { label: t.width, value: `${order.width} cm` },
          { label: t.quantity, value: order.quantity },
          { label: t.rollsGenerated, value: order.rollsGenerated },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs text-slate-400 mb-1">{label}</div>
            <div className="text-lg font-semibold text-slate-800">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">{t.fabricRolls} ({rolls?.length || 0})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.rollCode}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.color}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.length}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.weight}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.status}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(rolls || []).map((roll) => (
                <tr key={roll.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{roll.rollCode}</td>
                  <td className="px-4 py-3 text-slate-600">{roll.color}</td>
                  <td className="px-4 py-3 text-slate-600">{roll.length}m</td>
                  <td className="px-4 py-3 text-slate-600">{roll.weight}kg</td>
                  <td className="px-4 py-3"><StatusBadge status={roll.status} /></td>
                  <td className="px-4 py-3">
                    <Link href={`/fabric-rolls/${roll.id}`}>
                      <button className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">{t.view}</button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
