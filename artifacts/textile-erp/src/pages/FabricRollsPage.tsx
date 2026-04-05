import { useState } from "react";
import { Link } from "wouter";
import { useLang } from "@/contexts/LangContext";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useListFabricRolls, useUpdateFabricRoll, getListFabricRollsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Filter, Eye } from "lucide-react";

const ROLL_STATUSES = [
  "CREATED", "IN_PRODUCTION", "QC_PENDING", "QC_PASSED", "QC_FAILED",
  "SENT_TO_DYEING", "IN_DYEING", "FINISHED", "IN_STOCK", "RESERVED", "SOLD",
];

export function FabricRollsPage() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: rolls, isLoading } = useListFabricRolls(
    {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search ? { search } : {}),
      limit: 100,
    }
  );

  const updateRoll = useUpdateFabricRoll({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListFabricRollsQueryKey() }),
    },
  });

  return (
    <Layout>
      <PageHeader title={t.fabricRolls} />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center shadow-sm">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t.search + " " + t.rollCode + "..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-300 rounded-lg ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">{t.all}</option>
            {ROLL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {(t as unknown as Record<string, string>)[s] || s}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-slate-500">
          {rolls?.length || 0} {t.count}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.rollCode}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.fabricType}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.color}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.gsm}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.length}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.weight}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.status}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : (rolls || []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    {t.noRolls}
                  </td>
                </tr>
              ) : (
                (rolls || []).map((roll) => (
                  <tr key={roll.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 font-medium">{roll.rollCode}</td>
                    <td className="px-4 py-3 text-slate-600">{roll.fabricType}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-slate-200 flex-shrink-0"
                          style={{ backgroundColor: roll.color.toLowerCase() }}
                        ></div>
                        <span className="text-slate-600">{roll.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{roll.gsm}</td>
                    <td className="px-4 py-3 text-slate-600">{roll.length}m</td>
                    <td className="px-4 py-3 text-slate-600">{roll.weight}kg</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={roll.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/fabric-rolls/${roll.id}`}>
                        <button className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-xs font-medium transition-colors">
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
