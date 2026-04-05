import { useState } from "react";
import { Link } from "wouter";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useListQcReports,
  useCreateQcReport,
  useListFabricRolls,
  getListQcReportsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { formatDate } from "@/lib/format";

export function QualityControlPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    fabricRollId: "",
    result: "PASS",
    defects: "",
    defectCount: "0",
    notes: "",
  });

  const { data: reports, isLoading, error: reportsError } = useListQcReports({});
  const { data: eligibleRolls, error: rollsError } = useListFabricRolls({ status: "QC_PENDING", limit: 200 });

  const createReport = useCreateQcReport({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListQcReportsQueryKey() });
        setShowCreate(false);
        setForm({ fabricRollId: "", result: "PASS", defects: "", defectCount: "0", notes: "" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createReport.mutate({
      data: {
        fabricRollId: parseInt(form.fabricRollId),
        result: form.result,
        defects: form.defects || undefined,
        defectCount: parseInt(form.defectCount),
        notes: form.notes || undefined,
      },
    });
  };

  const accessError = [reportsError, rollsError].find(Boolean) as
    | {
        status?: number;
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
        title={t.qualityControl}
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            {t.addQcReport}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{t.addQcReport}</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.eligibleQcRolls}</label>
                <select
                  value={form.fabricRollId}
                  onChange={(e) => setForm({ ...form, fabricRollId: e.target.value })}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t.search}...</option>
                  {(eligibleRolls || []).map((roll) => (
                    <option key={roll.id} value={roll.id}>
                      {roll.rollCode} - {roll.fabricType}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.result}</label>
                <select
                  value={form.result}
                  onChange={(e) => setForm({ ...form, result: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="PASS">{t.PASS}</option>
                  <option value="FAIL">{t.FAIL}</option>
                  <option value="SECOND">{t.SECOND}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.defectCount}</label>
                <input
                  type="number"
                  min="0"
                  value={form.defectCount}
                  onChange={(e) => setForm({ ...form, defectCount: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.defects}</label>
                <input
                  type="text"
                  value={form.defects}
                  onChange={(e) => setForm({ ...form, defects: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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
                  disabled={createReport.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {createReport.isPending ? t.loading : t.save}
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
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.rollCode}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.result}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.defectCount}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.defects}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.inspectedAt}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.notes}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                    ))}
                  </tr>
                ))
              ) : accessErrorMessage ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">{accessErrorMessage}</td>
                </tr>
              ) : (reports || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">{t.noData}</td>
                </tr>
              ) : (
                (reports || []).map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">#{report.fabricRollId}</td>
                    <td className="px-4 py-3"><StatusBadge status={report.result} /></td>
                    <td className="px-4 py-3 text-slate-600">{report.defectCount}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{report.defects || "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(report.inspectedAt, lang)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{report.notes || "—"}</td>
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
